import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMetric, compareRuns, markdown, parseAndroidMetrics, parseIosMetrics, validateMetrics } from './report.mjs';

test('zero baselines retain absolute regressions without infinite percentages', () => {
  const result = compareMetric([0, 0, 0], [2, 2, 2]);
  assert.equal(result.percent, null);
  assert.equal(result.delta, 2);
  assert.equal(result.verdict, 'regressed');
});

test('noisy measurements remain inconclusive', () => {
  const result = compareMetric([50, 100, 150], [70, 120, 170]);
  assert.equal(result.verdict, 'inconclusive');
});

test('frame rate and negative memory deltas have correct directions', () => {
  const fps = compareMetric([50, 50], [60, 60], { higherIsBetter: true });
  assert.equal(fps.verdict, 'improved');
  const memory = compareMetric([-5, -5], [-10, -10]);
  assert.equal(memory.verdict, 'improved');
});

test('Android frame percentiles are calculated per iteration', () => {
  const document = { benchmarks: [{ name: 'scroll', sampledMetrics: { frameOverrunMs: { runs: [[-5, -2, 10], [-6, -1, 20]] } } }] };
  const metrics = parseAndroidMetrics(document);
  assert.deepEqual(metrics['scroll/frameOverrunMsP95'].values, [10, 20]);
  assert.equal(metrics['scroll/frameOverrunMsP95'].unit, 'ms');
});

test('Xcode exports keep native metric names, units and polarity', () => {
  const native = {
    identifier: 'com.apple.dt.XCTMetric_OSSignpost-Scroll_DraggingAndDeceleration.frameRate',
    displayName: 'Frame Rate (Scroll_DraggingAndDeceleration)',
    unitOfMeasurement: 'fps',
    polarity: 'prefers larger',
    measurements: [59, 60, 59, 60, 60],
  };
  const document = [{ testIdentifier: 'ListPerformanceTests/testScroll()', testRuns: [{ metrics: [native] }] }];
  const metrics = parseIosMetrics(document);
  const key = `scroll/${native.identifier}`;
  assert.equal(metrics[key].higherIsBetter, true);
  assert.equal(metrics[key].unit, 'fps');
  assert.deepEqual(metrics[key].values, native.measurements);
  assert.throws(() => validateMetrics(metrics, 'ios'), /Missing required ios metric/);
});

test('missing and nonfinite readings fail instead of becoming zeros', () => {
  assert.throws(() => compareMetric([], [1]));
  assert.throws(() => compareMetric([null], [1]));
  assert.throws(() => compareMetric([NaN], [1]));
  assert.throws(() => validateMetrics({}, 'ios'));
  assert.throws(() => parseIosMetrics([{ testIdentifier: 'testMount', testRuns: [{ metrics: [{ identifier: 'cpu', measurements: [null] }] }] }]));
});

test('comparison refuses partial or unpaired native metric sets', () => {
  const metrics = {
    'mount/ListMountFirstMs': { unit: 'ms', values: [1, 1, 1, 1, 1] },
    'scroll/cpuTimeMs': { unit: 'ms', values: [10, 10, 10, 10, 10] },
    'scroll/memoryRssAnonMaxKb': { unit: 'KiB', values: [100, 100, 100, 100, 100] },
    'scroll/frameOverrunMsP95': { unit: 'ms', values: [2, 2, 2, 2, 2] },
    'scroll/jankRatePercent': { unit: '%', values: [0, 0, 0, 0, 0] },
    'scroll/droppedFrames': { unit: 'count', values: [0, 0, 0, 0, 0] },
    'scroll/interactionPresentedFps': { unit: 'fps', values: [60, 60, 60, 60, 60] },
    'scroll/presentedSurfaceFrames': { unit: 'count', values: [30, 30, 30, 30, 30] },
    'scroll/classifiedSurfaceFrames': { unit: 'count', values: [30, 30, 30, 30, 30] },
    'scroll/jankyClassifiedFrames': { unit: 'count', values: [0, 0, 0, 0, 0] },
    'scroll/classificationCoveragePercent': { unit: '%', values: [100, 100, 100, 100, 100] },
  };
  assert.throws(() => compareRuns([{ label: 'main', metrics }], 'android', 5));
  const result = compareRuns([{ label: 'main', metrics }, { label: 'current', metrics }], 'android', 5);
  assert.equal(result['scroll/cpuTimeMs'].verdict, 'unchanged');
  const incompatible = { ...metrics, 'scroll/cpuTimeMs': { unit: 'seconds', values: [0.01, 0.01, 0.01, 0.01, 0.01] } };
  assert.throws(() => compareRuns([{ label: 'main', metrics }, { label: 'current', metrics: incompatible }], 'android', 5));
  const extra = { ...metrics, 'scroll/extraMetric': { unit: 'count', values: [30, 30, 30, 30, 30] } };
  const partial = [{ label: 'main', metrics: extra }, { label: 'current', metrics: extra }, { label: 'current', metrics }];
  assert.throws(() => compareRuns(partial, 'android', 5), /metric set changed/);
});

test('discarded or partially exported iterations invalidate a comparison', () => {
  const metrics = { 'scroll/cpuTimeMs': { unit: 'ms', values: [1, 2, 3, 4] } };
  assert.throws(() => validateMetrics(metrics, 'android'), /five measured iterations/);
});

function androidReadings(classified = [100, 100, 100, 100, 100]) {
  const coverage = [...classified];
  const janky = classified.map((count) => Math.min(count, 10));
  return { benchmarks: [
    { name: 'mount', metrics: { ListMountFirstMs: { runs: [1, 1, 1, 1, 1] } } },
    { name: 'scroll', metrics: {
      cpuTimeMs: { runs: [10, 10, 10, 10, 10] },
      memoryRssAnonMaxKb: { runs: [100, 100, 100, 100, 100] },
      presentedSurfaceFrames: { runs: [100, 100, 100, 100, 100] },
      classifiedSurfaceFrames: { runs: classified },
      jankyClassifiedFrames: { runs: janky },
      classificationCoveragePercent: { runs: coverage },
      droppedFrames: { runs: [0, 0, 0, 0, 0] },
      interactionPresentedFps: { runs: [60, 60, 60, 60, 60] },
    }, sampledMetrics: { frameOverrunMs: { runs: [[1], [1], [1], [1], [1]] } } },
  ] };
}

test('complete classification produces jank rates while partial and zero coverage remain unavailable', () => {
  const complete = androidReadings();
  const completeMetrics = parseAndroidMetrics(complete);
  assert.deepEqual(completeMetrics['scroll/jankRatePercent'].values, [10, 10, 10, 10, 10]);
  for (const counts of [[100, 100, 99, 100, 100], [0, 0, 0, 0, 0]]) {
    const document = androidReadings(counts);
    const metrics = parseAndroidMetrics(document);
    validateMetrics(metrics, 'android');
    assert.deepEqual(metrics['scroll/jankRatePercent'].values, []);
    assert.match(metrics['scroll/jankRatePercent'].unavailableReason, /Incomplete/);
    assert.deepEqual(metrics['scroll/classificationCoveragePercent'].values, counts);
  }
});

test('one incomplete block withholds jank for the full comparison without discarding other metrics', () => {
  const completeDocument = androidReadings();
  const partialDocument = androidReadings([100, 100, 50, 100, 100]);
  const complete = parseAndroidMetrics(completeDocument);
  const partial = parseAndroidMetrics(partialDocument);
  const runs = [
    { label: 'main', metrics: complete },
    { label: 'current', metrics: partial },
    { label: 'current', metrics: complete },
    { label: 'main', metrics: complete },
  ];
  const comparison = compareRuns(runs, 'android', 5);
  assert.equal(comparison['scroll/jankRatePercent'].verdict, 'unavailable');
  assert.equal(comparison['scroll/jankRatePercent'].current, null);
  assert.equal(comparison['scroll/cpuTimeMs'].verdict, 'unchanged');
  assert.equal(comparison['scroll/cpuTimeMs'].current.count, 10);
  assert.equal(comparison['scroll/classificationCoveragePercent'].verdict, 'context');
  const report = {
    sources: { main: { commit: 'base' }, current: { commit: 'candidate', sourceHash: 'hash' } },
    suiteHash: 'suite', platforms: { android: { device: { name: 'phone' }, comparison } },
  };
  const text = markdown(report);
  assert.match(text, /jankRatePercent \(%\) \| n\/a \| n\/a \| n\/a \| unavailable: Incomplete/);
});

test('missing or inconsistent frame counts still invalidate a run', () => {
  const missing = androidReadings();
  delete missing.benchmarks[1].metrics.classifiedSurfaceFrames;
  assert.throws(() => parseAndroidMetrics(missing), /Missing aligned/);
  const invalid = androidReadings([100, 100, 101, 100, 100]);
  assert.throws(() => parseAndroidMetrics(invalid), /Invalid app frame/);
  const coverage = androidReadings();
  coverage.benchmarks[1].metrics.classificationCoveragePercent.runs[0] = 90;
  assert.throws(() => parseAndroidMetrics(coverage), /Inconsistent/);
  const missingCpu = androidReadings([50, 50, 50, 50, 50]);
  delete missingCpu.benchmarks[1].metrics.cpuTimeMs;
  const metrics = parseAndroidMetrics(missingCpu);
  assert.throws(() => validateMetrics(metrics, 'android'), /Missing required/);
  metrics['scroll/cpuTimeMs'] = { values: [], unavailableReason: 'missing', unit: 'ms' };
  assert.throws(() => validateMetrics(metrics, 'android'), /Unexpected unavailable/);
});
