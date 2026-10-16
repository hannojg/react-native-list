import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { command, jsonCommand } from './process.mjs';
import { parseAndroidMetrics, parseIosMetrics, validateMetrics } from './report.mjs';

export const appId = 'com.hannojg.list.perf';

export async function discover(platform, requested, output) {
  if (platform === 'ios') {
    const file = path.join(output, 'ios-devices.json');
    await command('xcrun', ['devicectl', 'list', 'devices', '--json-output', file], { capture: true });
    const contents = await readFile(file, 'utf8');
    const document = JSON.parse(contents);
    if (document.info.jsonVersion < 5) throw new Error('Physical iPhone discovery requires Xcode 27 or later');
    const candidates = document.result.devices.filter((device) => {
      const properties = device.properties;
      return properties.hardware.reality === 'physical' && properties.connection.state === 'connected';
    });
    const selected = select(candidates, requested, (device) => device.properties.hardware.udid, platform);
    const properties = selected.properties;
    const version = properties.software.osVersionNumber.stringValue;
    const major = Number.parseInt(version, 10);
    if (major < 26) throw new Error('iOS performance tests require iOS 26 or later');
    return { id: properties.hardware.udid, name: properties.state.name, os: version, model: properties.hardware.productType };
  }
  const devices = await command('adb', ['devices', '-l'], { capture: true });
  const candidates = devices.split('\n').slice(1).filter((line) => /^\S+\s+device\b/.test(line) && line.startsWith('emulator-') === false);
  const selected = select(candidates, requested, (line) => line.split(/\s+/)[0], platform);
  const id = selected.split(/\s+/)[0];
  const apiText = await command('adb', ['-s', id, 'shell', 'getprop', 'ro.build.version.sdk'], { capture: true });
  const api = Number(apiText);
  if (api < 31) throw new Error('Android performance tests require API 31 or later');
  const name = await command('adb', ['-s', id, 'shell', 'getprop', 'ro.product.model'], { capture: true });
  const os = await command('adb', ['-s', id, 'shell', 'getprop', 'ro.build.fingerprint'], { capture: true });
  const abi = await command('adb', ['-s', id, 'shell', 'getprop', 'ro.product.cpu.abi'], { capture: true });
  return { id, name, os, api, abi };
}

function select(candidates, requested, identity, platform) {
  const matches = requested ? candidates.filter((candidate) => identity(candidate) === requested) : candidates;
  if (matches.length !== 1) {
    const ids = candidates.map(identity);
    throw new Error(`Expected one connected physical ${platform} device. Available: ${ids.join(', ') || 'none'}. Use --${platform}-device <id> when several are connected.`);
  }
  return matches[0];
}

export async function prepare(checkout, platforms, { team, simulator = false, log }) {
  await command('git', ['submodule', 'update', '--init', '--recursive', '--depth', '1'], { cwd: checkout, log });
  // Only the shared patch metadata changes; dependency versions stay locked.
  const graphBefore = await dependencyGraph(checkout);
  await command('bun', ['install', '--lockfile-only', '--ignore-scripts'], { cwd: checkout, log });
  const graphAfter = await dependencyGraph(checkout);
  if (graphBefore !== graphAfter) throw new Error('Applying benchmark build patches changed the locked dependency graph');
  await command('bun', ['install', '--frozen-lockfile'], { cwd: checkout, log });
  const generatedWorklets = path.join(checkout, 'node_modules/react-native-worklets/.worklets');
  await mkdir(generatedWorklets, { recursive: true });
  const packageDirectory = path.join(checkout, 'package');
  await command('bun', ['run', 'bundle:js:prod'], { cwd: packageDirectory, log });
  const example = path.join(checkout, 'example');
  const expo = path.join(checkout, 'node_modules/expo/bin/cli');
  for (const platform of platforms) {
    await command(process.execPath, [expo, 'prebuild', '--no-install', '--platform', platform], { cwd: example, env: { CI: '1' }, log });
  }
  if (platforms.includes('ios')) {
    if (simulator === false && !team) throw new Error('Set PERF_IOS_TEAM or --ios-team to your Apple development team ID');
    const configure = path.join(checkout, 'perf/ios/configure.rb');
    const ruby = await command('ruby', ['-rrbconfig', '-e', 'print RbConfig.ruby'], { capture: true, log });
    await command(ruby, [configure, checkout, team ?? ''], { log });
    const ios = path.join(example, 'ios');
    await command('pod', ['install'], { cwd: ios, env: { NODE_ENV: 'production' }, log });
  }
  if (platforms.includes('android')) {
    const settings = path.join(example, 'android/settings.gradle');
    await append(settings, "\ninclude ':macrobenchmark'\nproject(':macrobenchmark').projectDir = file('../../perf/android')\n");
    const appGradle = path.join(example, 'android/app/build.gradle');
    await append(appGradle, "\ndependencies { implementation 'androidx.profileinstaller:profileinstaller:1.4.1' }\n");
    const manifest = path.join(example, 'android/app/src/main/AndroidManifest.xml');
    const contents = await readFile(manifest, 'utf8');
    const updated = contents.replace('</application>', '<profileable android:shell="true" /></application>');
    if (updated === contents) throw new Error('Generated Android application manifest has unexpected structure');
    await writeFile(manifest, updated);
  }
}

async function append(file, suffix) {
  const contents = await readFile(file, 'utf8');
  await writeFile(file, contents + suffix);
}

async function dependencyGraph(checkout) {
  const script = `
    const text = await Bun.file('bun.lock').text();
    const lock = Bun.JSON5.parse(text);
    const graph = JSON.stringify(lock.packages);
    const hash = new Bun.CryptoHasher('sha256');
    hash.update(graph);
    const digest = hash.digest('hex');
    console.log(digest);
  `;
  return command('bun', ['-e', script], { cwd: checkout, capture: true });
}

export async function build(checkout, platform, { device, simulator = false, log }) {
  if (platform === 'ios') {
    const ios = path.join(checkout, 'example/ios');
    let destination = 'generic/platform=iOS';
    if (device) destination = `platform=iOS,id=${device.id}`;
    if (simulator) destination = 'generic/platform=iOS Simulator';
    const args = ['build-for-testing', '-workspace', 'ListPerf.xcworkspace', '-scheme', 'ListPerformance', '-configuration', 'Release', '-destination', destination, '-derivedDataPath', 'build', '-parallel-testing-enabled', 'NO'];
    if (simulator) args.push('CODE_SIGNING_ALLOWED=NO', 'ARCHS=arm64');
    else args.push('-allowProvisioningUpdates');
    await command('xcodebuild', args, { cwd: ios, env: { NODE_ENV: 'production' }, log });
    const products = path.join(ios, 'build/Build/Products');
    const files = await readdir(products);
    const runFile = files.find((file) => file.endsWith('.xctestrun'));
    if (runFile === undefined) throw new Error('Xcode did not produce an xctestrun file');
    const xctestrun = path.join(products, runFile);
    // Xcode 27 leaves the UI target's checker enabled despite the test-plan option.
    await command('plutil', ['-replace', 'TestConfigurations.0.TestTargets.0.UITargetAppPerformanceAntipatternCheckerEnabled', '-bool', 'NO', xctestrun], { log });
    return { checkout, xctestrun };
  }
  const android = path.join(checkout, 'example/android');
  const abi = device?.abi ?? 'arm64-v8a';
  await command('./gradlew', [':app:assembleRelease', ':macrobenchmark:assembleRelease', `-PreactNativeArchitectures=${abi}`, '--console=plain', '--no-daemon'], { cwd: android, env: { NODE_ENV: 'production' }, log });
  const appDirectory = path.join(android, 'app/build/outputs/apk/release');
  const testDirectory = path.join(checkout, 'perf/android/build/outputs/apk/release');
  const app = await apk(appDirectory);
  const test = await apk(testDirectory);
  return { checkout, app, test };
}

async function apk(directory) {
  const metadata = path.join(directory, 'output-metadata.json');
  const text = await readFile(metadata, 'utf8');
  const document = JSON.parse(text);
  if (document.elements.length !== 1) throw new Error('Expected one universal APK');
  return path.join(directory, document.elements[0].outputFile);
}

export async function run(artifact, platform, device, directory, { profile = false } = {}) {
  await mkdir(directory, { recursive: true });
  const log = path.join(directory, 'run.log');
  if (platform === 'ios') return runIos(artifact, device, directory, log, profile);
  return runAndroid(artifact, device, directory, log);
}

async function runIos(artifact, device, directory, log, profile) {
  const result = path.join(directory, 'run.xcresult');
  const args = ['test-without-building', '-xctestrun', artifact.xctestrun, '-destination', `platform=iOS,id=${device.id}`, '-resultBundlePath', result, '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-device-destinations', '1'];
  if (profile) args.push('-only-testing:ListPerformanceTests/ListPerformanceTests/testScroll');
  let recording;
  try {
    if (profile) recording = await startProfile(device.id, directory);
    await command('xcodebuild', args, { log });
  } finally {
    if (recording) await recording.stop();
  }
  if (profile) return { trace: path.join(directory, 'profile.trace'), result };
  const metrics = await jsonCommand('xcrun', ['xcresulttool', 'get', 'test-results', 'metrics', '--path', result], { log });
  const raw = path.join(directory, 'metrics.json');
  const formatted = JSON.stringify(metrics, null, 2);
  await writeFile(raw, formatted);
  const parsed = parseIosMetrics(metrics);
  validateMetrics(parsed, 'ios');
  return { metrics: parsed, result };
}

async function runAndroid(artifact, device, directory, log) {
  await command('adb', ['-s', device.id, 'install', '-r', artifact.app], { log });
  await command('adb', ['-s', device.id, 'install', '-r', artifact.test], { log });
  await command('adb', ['-s', device.id, 'shell', 'pm', 'clear', appId], { log });
  await command('adb', ['-s', device.id, 'shell', 'pm', 'clear', `${appId}.tests`], { log });
  const remoteOutputs = `/sdcard/Android/media/${appId}.tests`;
  const copy = path.join(directory, 'android-output');
  // Invoke the installed test APK directly, so measurement cannot trigger a rebuild.
  const instrumentation = `${appId}.tests/androidx.test.runner.AndroidJUnitRunner`;
  const output = await command('adb', ['-s', device.id, 'shell', 'am', 'instrument', '-w', instrumentation], { capture: true, log });
  await command('adb', ['-s', device.id, 'pull', remoteOutputs, copy], { log });
  // AndroidJUnitRunner can exit zero even when a test failed.
  if (/^OK \(2 tests\)\s*$/m.test(output) === false) throw new Error(`Android instrumentation did not pass both scenarios. See ${log}`);
  const files = await findFiles(copy);
  const reports = files.filter((file) => file.endsWith('-benchmarkData.json'));
  if (reports.length !== 1) throw new Error(`Expected one Android benchmark report, got ${reports.length}`);
  const text = await readFile(reports[0], 'utf8');
  const document = JSON.parse(text);
  const metrics = parseAndroidMetrics(document);
  validateMetrics(metrics, 'android');
  const threadDirectory = path.join(directory, 'cpu-threads');
  await command('adb', ['-s', device.id, 'pull', `/sdcard/Android/data/${appId}.tests/files/cpu-threads`, threadDirectory], { log });
  const threadFiles = await readdir(threadDirectory);
  const threads = [];
  for (const name of threadFiles) {
    const file = path.join(threadDirectory, name);
    const text = await readFile(file, 'utf8');
    const data = JSON.parse(text);
    threads.push(data);
  }
  if (threads.length !== 10) throw new Error(`Expected 10 per-iteration CPU thread reports, got ${threads.length}`);
  return { metrics, threads, result: reports[0] };
}

async function findFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(file));
    else files.push(file);
  }
  return files;
}

async function startProfile(device, directory) {
  const notification = `com.hannojg.list.perf.${process.pid}`;
  const ready = spawn('/usr/bin/notifyutil', ['-1', notification], { stdio: 'ignore' });
  const readyExit = once(ready, 'exit');
  const trace = path.join(directory, 'profile.trace');
  const child = spawn('xcrun', ['xctrace', 'record', '--template', 'Time Profiler', '--device', device, '--all-processes', '--notify-tracing-started', notification, '--output', trace], { stdio: ['ignore', 'pipe', 'pipe'] });
  const log = path.join(directory, 'profile.log');
  let messages = '';
  child.stdout.on('data', (chunk) => { messages += chunk; });
  child.stderr.on('data', (chunk) => { messages += chunk; });
  const exit = once(child, 'exit');
  let timer;
  try {
    await Promise.race([
      readyExit.then(([code]) => { if (code !== 0) throw new Error('Trace readiness listener failed'); }),
      exit.then(() => { throw new Error(`Instruments stopped before becoming ready: ${messages}`); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Instruments readiness timed out')), 60_000); }),
    ]);
  } catch (error) {
    child.kill('SIGINT');
    ready.kill();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return {
    async stop() {
      child.kill('SIGINT');
      const [code] = await exit;
      await writeFile(log, messages);
      if (code !== 0) throw new Error(`Instruments failed: ${messages}`);
      const contents = await command('xcrun', ['xctrace', 'export', '--input', trace, '--toc'], { capture: true });
      const toc = path.join(directory, 'profile-toc.xml');
      await writeFile(toc, contents);
    },
  };
}
