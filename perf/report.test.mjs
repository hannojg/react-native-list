import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMetric, compareRuns, parseAndroidMetrics, parseIosMetrics, validateMetrics } from './report.mjs';

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
  };
  assert.throws(() => compareRuns([{ label: 'main', metrics }], 'android', 5));
  const result = compareRuns([{ label: 'main', metrics }, { label: 'current', metrics }], 'android', 5);
  assert.equal(result['scroll/cpuTimeMs'].verdict, 'unchanged');
  const incompatible = { ...metrics, 'scroll/cpuTimeMs': { unit: 'seconds', values: [0.01, 0.01, 0.01, 0.01, 0.01] } };
  assert.throws(() => compareRuns([{ label: 'main', metrics }, { label: 'current', metrics: incompatible }], 'android', 5));
  const extra = { ...metrics, 'scroll/presentedSurfaceFrames': { unit: 'count', values: [30, 30, 30, 30, 30] } };
  const partial = [{ label: 'main', metrics: extra }, { label: 'current', metrics: extra }, { label: 'current', metrics }];
  assert.throws(() => compareRuns(partial, 'android', 5), /metric set changed/);
});

test('discarded or partially exported iterations invalidate a comparison', () => {
  const metrics = { 'scroll/cpuTimeMs': { unit: 'ms', values: [1, 2, 3, 4] } };
  assert.throws(() => validateMetrics(metrics, 'android'), /five measured iterations/);
});
