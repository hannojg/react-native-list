#!/usr/bin/env node
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { command } from './process.mjs';
import { fingerprint, installHarness, snapshot } from './snapshot.mjs';
import { build, discover, prepare, run } from './platforms.mjs';
import { compareRuns, markdown } from './report.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: 'string', default: 'origin/main' },
    platform: { type: 'string', default: 'both' },
    'ios-device': { type: 'string' },
    'android-device': { type: 'string' },
    'ios-team': { type: 'string', default: process.env.PERF_IOS_TEAM },
    rounds: { type: 'string', default: '1' },
    threshold: { type: 'string', default: '5' },
    output: { type: 'string' },
    profile: { type: 'boolean', default: false },
    simulator: { type: 'boolean', default: false },
    'keep-builds': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});

const action = positionals[0] ?? 'compare';
if (values.help) {
  console.log(`Usage: bun perf compare [--base origin/main] [--platform both|ios|android]
  --ios-device <UDID>       Select a connected physical iPhone
  --android-device <id>     Select a connected physical Android device
  --ios-team <team>         Apple development team (or PERF_IOS_TEAM)
  --rounds <n>              Number of main/current/current/main blocks (default 1)
  --threshold <percent>     Practical change threshold (default 5)
  --profile                Also record an Instruments profile of each iOS build
  --output <directory>      New result directory (default .perf/results/<timestamp>)
  --keep-builds             Retain isolated source/build checkouts

Compilation only: bun perf build --platform ios|android [--simulator]
Measurements require physical devices. Build --simulator compiles iOS only.
The base ref is resolved locally; run git fetch origin before comparing.`);
} else {
  try { await main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

async function main() {
  if (positionals.length > 1) throw new Error('Expected one action: compare or build');
  if (['compare', 'build'].includes(action) === false) throw new Error(`Unknown action: ${action}`);
  if (['both', 'ios', 'android'].includes(values.platform) === false) throw new Error('Use --platform both, ios or android');
  if (values.simulator && (action !== 'build' || values.platform !== 'ios')) throw new Error('--simulator is only supported by build --platform ios');
  const rounds = Number(values.rounds);
  const threshold = Number(values.threshold);
  if (Number.isInteger(rounds) === false || rounds < 1 || rounds > 10) throw new Error('--rounds must be between 1 and 10');
  if (Number.isFinite(threshold) === false || threshold < 0) throw new Error('--threshold must be nonnegative');
  const platforms = values.platform === 'both' ? ['ios', 'android'] : [values.platform];
  const script = fileURLToPath(import.meta.url);
  const parent = path.dirname(script);
  const root = await command('git', ['rev-parse', '--show-toplevel'], { cwd: parent, capture: true });
  const now = new Date();
  const iso = now.toISOString();
  const timestamp = iso.replaceAll(':', '-');
  const output = values.output ? path.resolve(values.output) : path.join(root, '.perf/results', timestamp);
  const relativeOutput = path.relative(root, output);
  const outside = relativeOutput === '..' || relativeOutput.startsWith(`..${path.sep}`);
  const ignored = relativeOutput.startsWith(`.perf${path.sep}`);
  if (outside === false && ignored === false) {
    throw new Error('Put results under .perf/ or outside the repository so they cannot enter the source snapshot');
  }
  const outputParent = path.dirname(output);
  await mkdir(outputParent, { recursive: true });
  await mkdir(output, { recursive: false });
  console.log(`Results: ${output}`);
  const devices = {};
  if (action === 'compare') {
    for (const platform of platforms) devices[platform] = await discover(platform, values[`${platform}-device`], output);
    if (platforms.includes('ios') && !values['ios-team']) throw new Error('Set PERF_IOS_TEAM or --ios-team before building for iPhone');
  }
  const systemTemporary = tmpdir();
  const temporary = path.join(systemTemporary, 'ui-list-perf-');
  const workspace = await mkdtemp(temporary);
  const log = path.join(output, 'build.log');
  let success = false;
  try {
    const current = path.join(workspace, 'current');
    const sources = {};
    sources.current = await snapshot(root, current, 'HEAD', { current: true, log });
    const suite = path.join(workspace, 'suite');
    const suiteSource = path.join(current, 'perf');
    await cp(suiteSource, suite, { recursive: true });
    const fixture = path.join(workspace, 'benchmark-fixture.ts');
    const fixtureSource = path.join(current, 'example/src/examples/chatBenchmarkData.ts');
    await cp(fixtureSource, fixture);
    const suiteFixture = path.join(suite, 'benchmark-fixture.ts');
    await cp(fixture, suiteFixture);
    const buildPatches = path.join(suite, 'build-patches');
    await mkdir(buildPatches);
    for (const name of ['metro@0.84.5.patch', 'metro-runtime@0.84.5.patch']) {
      const source = path.join(current, 'patches', name);
      const destination = path.join(buildPatches, name);
      await cp(source, destination);
    }
    const suiteHash = await fingerprint(suite);
    const checkouts = { current };
    if (action === 'compare') {
      const main = path.join(workspace, 'main');
      sources.main = await snapshot(root, main, values.base, { log });
      checkouts.main = main;
    }
    const created = new Date();
    const createdAt = created.toISOString();
    const bun = await command('bun', ['--version'], { capture: true });
    const tools = { node: process.version, bun };
    if (platforms.includes('ios')) tools.xcode = await command('xcodebuild', ['-version'], { capture: true });
    const report = { version: 1, createdAt, baseRef: values.base, sources, suiteHash, tools, thresholdPercent: threshold, rounds, platforms: {} };
    const manifestFile = path.join(output, 'manifest.json');
    await saveJson(manifestFile, { ...report, devices, workspace });
    const artifacts = {};
    for (const [label, checkout] of Object.entries(checkouts)) {
      console.log(`Preparing ${label} (${sources[label].commit})`);
      await installHarness(suite, checkout, fixture);
      await prepare(checkout, platforms, { team: values['ios-team'], simulator: values.simulator, log });
      artifacts[label] = {};
      for (const platform of platforms) {
        console.log(`Building ${label}/${platform}`);
        artifacts[label][platform] = await build(checkout, platform, { device: devices[platform], simulator: values.simulator, log });
      }
    }
    if (action === 'build') {
      console.log(`Builds completed: ${workspace}`);
      success = true;
      return;
    }
    for (const platform of platforms) {
      const runs = [];
      for (let round = 0; round < rounds; round += 1) {
        const order = ['main', 'current', 'current', 'main'];
        for (let index = 0; index < order.length; index += 1) {
          const label = order[index];
          const directory = path.join(output, platform, `${round}-${index}-${label}`);
          console.log(`Measuring ${platform}/${label}, block ${round + 1}.${index + 1}`);
          const result = await run(artifacts[label][platform], platform, devices[platform], directory);
          runs.push({ label, round, block: index, ...result });
          const runsFile = path.join(output, `${platform}-runs.json`);
          await saveJson(runsFile, runs);
        }
      }
      const comparison = compareRuns(runs, platform, threshold);
      report.platforms[platform] = { device: devices[platform], runs, comparison };
      if (values.profile && platform === 'ios') {
        for (const label of ['main', 'current']) {
          const directory = path.join(output, platform, `profile-${label}`);
          console.log(`Profiling ${platform}/${label}`);
          await run(artifacts[label][platform], platform, devices[platform], directory, { profile: true });
        }
      }
    }
    const comparisonFile = path.join(output, 'comparison.json');
    await saveJson(comparisonFile, report);
    const text = markdown(report);
    const markdownFile = path.join(output, 'comparison.md');
    await writeFile(markdownFile, text);
    console.log(text);
    success = true;
  } finally {
    if (values['keep-builds'] || action === 'build') console.log(`Isolated checkouts retained: ${workspace}`);
    else await rm(workspace, { recursive: true, force: true });
    if (success === false) console.error(`Comparison incomplete. Logs and partial results: ${output}`);
  }
}

async function saveJson(file, data) {
  const text = JSON.stringify(data, null, 2);
  await writeFile(file, text);
}
