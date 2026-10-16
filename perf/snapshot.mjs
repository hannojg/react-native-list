import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { command } from './process.mjs';

export async function fingerprint(directory) {
  const hash = createHash('sha256');
  async function visit(relative) {
    const absolute = path.join(directory, relative);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`Benchmark inputs must not be symlinks: ${absolute}`);
    if (info.isDirectory()) {
      const entries = await readdir(absolute);
      entries.sort();
      for (const entry of entries) {
        const child = path.join(relative, entry);
        await visit(child);
      }
    } else {
      hash.update(relative);
      hash.update('\0');
      const bytes = await readFile(absolute);
      hash.update(bytes);
      hash.update('\0');
    }
  }
  await visit('');
  return hash.digest('hex');
}

export async function snapshot(root, destination, revision, { current = false, log } = {}) {
  const commit = await command('git', ['rev-parse', '--verify', `${revision}^{commit}`], { cwd: root, capture: true });
  await command('git', ['clone', '--shared', '--no-checkout', root, destination], { log });
  await command('git', ['checkout', '--detach', commit], { cwd: destination, log });
  if (current) {
    const files = await command('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, capture: true, trim: false });
    const stages = await command('git', ['ls-files', '--stage'], { cwd: root, capture: true });
    const submodules = new Set();
    for (const line of stages.split('\n')) {
      if (line.startsWith('160000 ')) {
        const fields = line.split('\t');
        const relative = fields[1];
        const changes = await command('git', ['status', '--porcelain', '--ignore-submodules=none', '--', relative], { cwd: root, capture: true });
        if (changes.length > 0) throw new Error(`Commit submodule changes before benchmarking: ${relative}`);
        submodules.add(relative);
      }
    }
    for (const relative of files.split('\0')) {
      if (relative.length === 0 || submodules.has(relative)) continue;
      const source = path.join(root, relative);
      const target = path.join(destination, relative);
      try {
        const info = await lstat(source);
        if (info.isDirectory()) throw new Error(`Unexpected tracked directory: ${relative}`);
        const parent = path.dirname(target);
        await mkdir(parent, { recursive: true });
        await rm(target, { force: true });
        await cp(source, target, { dereference: false, verbatimSymlinks: true });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await rm(target, { force: true });
      }
    }
  }
  const diff = await command('git', ['diff', '--binary', 'HEAD'], { cwd: destination, capture: true });
  const hash = createHash('sha256');
  hash.update(commit);
  hash.update(diff);
  const untracked = await command('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: destination, capture: true, trim: false });
  for (const relative of untracked.split('\0')) {
    if (relative.length === 0) continue;
    hash.update(relative);
    const file = path.join(destination, relative);
    const bytes = await readFile(file);
    hash.update(bytes);
  }
  return { commit, sourceHash: hash.digest('hex'), dirty: diff.length > 0 || untracked.length > 0 };
}

export async function installHarness(suite, checkout, fixture) {
  const perf = path.join(checkout, 'perf');
  await rm(perf, { recursive: true, force: true });
  await cp(suite, perf, { recursive: true });
  const screenSource = path.join(suite, 'app/BenchmarkApp.tsx');
  const screenTarget = path.join(checkout, 'example/BenchmarkApp.tsx');
  await cp(screenSource, screenTarget);
  const fixtureTarget = path.join(checkout, 'example/benchmark-fixture.ts');
  await cp(fixture, fixtureTarget);
  const entry = path.join(checkout, 'example/App.tsx');
  await writeFile(entry, "export { default } from './BenchmarkApp';\n");
  const moduleSource = path.join(suite, 'native');
  const moduleTarget = path.join(checkout, 'example/modules/list-benchmark');
  await cp(moduleSource, moduleTarget, { recursive: true });
  const configPath = path.join(checkout, 'example/app.json');
  const configText = await readFile(configPath, 'utf8');
  const config = JSON.parse(configText);
  config.expo.name = 'ListPerf';
  config.expo.slug = 'list-perf';
  config.expo.orientation = 'portrait';
  config.expo.userInterfaceStyle = 'light';
  config.expo.ios.bundleIdentifier = 'com.hannojg.list.perf';
  config.expo.android.package = 'com.hannojg.list.perf';
  config.expo.ios.infoPlist = { ...config.expo.ios.infoPlist, CADisableMinimumFrameDurationOnPhone: true };
  const properties = config.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  if (properties === undefined) throw new Error('Benchmark requires expo-build-properties');
  properties[1].ios.deploymentTarget = '26.0';
  properties[1].android.minSdkVersion = 31;
  const formatted = JSON.stringify(config, null, 2);
  await writeFile(configPath, formatted);
  const manifest = path.join(checkout, 'package.json');
  const manifestText = await readFile(manifest, 'utf8');
  const dependencies = JSON.parse(manifestText);
  dependencies.patchedDependencies['metro@0.84.5'] = 'perf/build-patches/metro@0.84.5.patch';
  dependencies.patchedDependencies['metro-runtime@0.84.5'] = 'perf/build-patches/metro-runtime@0.84.5.patch';
  const manifestJson = JSON.stringify(dependencies, null, 2);
  await writeFile(manifest, manifestJson);
}
