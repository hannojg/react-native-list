const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function median(values) {
  if (values.length === 0 || values.some((value) => finite(value) === false)) {
    throw new Error('Expected nonempty finite measurements');
  }
  const sorted = [...values];
  sorted.sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(values) {
  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { median: center, mad, min, max, count: values.length };
}

export function compareMetric(baseline, current, { thresholdPercent = 5, higherIsBetter = false } = {}) {
  const before = summarize(baseline);
  const after = summarize(current);
  const delta = after.median - before.median;
  const magnitude = Math.abs(before.median);
  const percent = magnitude > 0 ? delta / magnitude * 100 : null;
  const threshold = magnitude * thresholdPercent / 100;
  // A heuristic noise band, not a confidence interval or a significance test.
  const deviation = Math.max(before.mad, after.mad);
  const noise = 3 * deviation;
  let verdict;
  if (Math.abs(delta) <= threshold) verdict = 'unchanged';
  else if (Math.abs(delta) <= noise) verdict = 'inconclusive';
  else {
    const better = higherIsBetter ? delta > 0 : delta < 0;
    verdict = better ? 'improved' : 'regressed';
  }
  return { baseline: before, current: after, delta, percent, noise, verdict };
}

export function parseIosMetrics(tests) {
  if (Array.isArray(tests) === false) throw new Error('Unexpected xcresult metrics schema');
  const result = {};
  for (const test of tests) {
    const scenario = test.testIdentifier?.includes('testMount') ? 'mount' : 'scroll';
    for (const run of test.testRuns ?? []) {
      for (const metric of run.metrics ?? []) {
        const id = metric.identifier ?? metric.displayName;
        const key = `${scenario}/${id}`;
        const samples = metric.measurements;
        summarize(samples);
        result[key] = {
          displayName: metric.displayName,
          unit: metric.unitOfMeasurement,
          values: samples,
          informational: /frame count|animation.*duration/i.test(metric.displayName) || (scenario === 'scroll' && id.endsWith('.duration')),
          higherIsBetter: metric.polarity === 'prefers larger',
        };
      }
    }
  }
  return result;
}

export function parseAndroidMetrics(document) {
  const result = {};
  for (const benchmark of document.benchmarks ?? []) {
    const scenario = benchmark.name.includes('mount') ? 'mount' : 'scroll';
    for (const [name, metric] of Object.entries(benchmark.metrics ?? {})) {
      const values = metric.runs;
      summarize(values);
      const measurementUnit = unit(name);
      const informational = ['frameCount', 'presentedSurfaceFrames', 'classifiedSurfaceFrames', 'jankyClassifiedFrames', 'classificationCoveragePercent', 'interactionPresentedFps'].includes(name);
      result[`${scenario}/${name}`] = { values, unit: measurementUnit, informational, higherIsBetter: name === 'classificationCoveragePercent' };
    }
    for (const [name, metric] of Object.entries(benchmark.sampledMetrics ?? {})) {
      // Compare per-iteration percentiles, rather than treating correlated frames as independent runs.
      const runs = metric.runs;
      if (Array.isArray(runs) === false) throw new Error(`Missing per-iteration samples for ${name}`);
      const values = runs.map((samples) => {
        if (samples.length === 0) throw new Error(`Empty samples for ${name}`);
        const sorted = [...samples];
        sorted.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * 0.95) - 1;
        return sorted[index];
      });
      summarize(values);
      const measurementUnit = unit(name);
      result[`${scenario}/${name}P95`] = { values, unit: measurementUnit, higherIsBetter: false };
    }
  }
  if (result['scroll/presentedSurfaceFrames']) {
    const frames = result['scroll/presentedSurfaceFrames'].values;
    const classified = result['scroll/classifiedSurfaceFrames']?.values;
    const janky = result['scroll/jankyClassifiedFrames']?.values;
    const coverage = result['scroll/classificationCoveragePercent']?.values;
    const aligned = [classified, janky, coverage].every((values) => values?.length === frames.length);
    if (aligned === false) throw new Error('Missing aligned app frame classification counts');
    for (let index = 0; index < frames.length; index += 1) {
      const counts = [frames[index], classified[index], janky[index]];
      const integers = counts.every(Number.isInteger);
      if (integers === false || frames[index] <= 0 || classified[index] < 0 || classified[index] > frames[index] || janky[index] < 0 || janky[index] > classified[index]) {
        throw new Error('Invalid app frame classification counts');
      }
      const expectedCoverage = classified[index] * 100 / frames[index];
      if (Math.abs(coverage[index] - expectedCoverage) > 0.000001) throw new Error('Inconsistent app frame classification coverage');
    }
    const complete = classified.every((count, index) => count === frames[index]);
    const values = complete ? janky.map((count, index) => count * 100 / frames[index]) : [];
    const unavailableReason = complete ? undefined : 'Incomplete app frame classification; jank comparison withheld';
    result['scroll/jankRatePercent'] = { values, unit: '%', unavailableReason };
  }
  return result;
}

function unit(name) {
  if (name.endsWith('Ms')) return 'ms';
  if (name.endsWith('Kb')) return 'KiB';
  if (name.endsWith('Percent')) return '%';
  if (name.endsWith('Fps')) return 'fps';
  return 'count';
}

export function validateMetrics(metrics, platform) {
  const keys = Object.keys(metrics);
  if (keys.length === 0) throw new Error('No measurements were exported');
  for (const [key, metric] of Object.entries(metrics)) {
    if (metric.unavailableReason !== undefined) {
      if (platform !== 'android' || key !== 'scroll/jankRatePercent' || metric.values.length !== 0) {
        throw new Error(`Unexpected unavailable metric: ${key}`);
      }
      continue;
    }
    summarize(metric.values);
    if (metric.values.length !== 5) throw new Error(`Expected five measured iterations for ${key}, got ${metric.values.length}`);
  }
  const required = platform === 'ios'
    ? [/^mount\/.*(signpost|duration|clock)/i, /^scroll\/.*cpu/i, /^scroll\/.*memory/i, /^scroll\/.*hitch/i, /^scroll\/.*(frame.?rate|fps)/i]
    : [/^mount\/ListMountFirstMs$/, /^scroll\/cpuTimeMs$/, /^scroll\/memoryRssAnonMaxKb$/, /^scroll\/frameOverrunMsP95$/, /^scroll\/jankRatePercent$/, /^scroll\/droppedFrames$/, /^scroll\/interactionPresentedFps$/, /^scroll\/presentedSurfaceFrames$/, /^scroll\/classifiedSurfaceFrames$/, /^scroll\/jankyClassifiedFrames$/, /^scroll\/classificationCoveragePercent$/];
  for (const pattern of required) {
    const present = keys.some((key) => {
      const description = `${key}/${metrics[key].displayName ?? ''}`;
      return pattern.test(key) || pattern.test(description);
    });
    if (present === false) throw new Error(`Missing required ${platform} metric: ${pattern}`);
  }
}

export function compareRuns(runs, platform, thresholdPercent) {
  const combined = { main: {}, current: {} };
  let expectedKeys;
  for (const run of runs) {
    validateMetrics(run.metrics, platform);
    const keys = Object.keys(run.metrics);
    keys.sort();
    const signature = keys.join('\n');
    if (expectedKeys !== undefined && signature !== expectedKeys) throw new Error('Native metric set changed between blocks');
    expectedKeys = signature;
    for (const [key, metric] of Object.entries(run.metrics)) {
      const previous = combined[run.label][key];
      if (previous && previous.unit !== metric.unit) throw new Error(`Unit changed for ${key}`);
      const unavailableReason = previous?.unavailableReason ?? metric.unavailableReason;
      const readings = previous ? [...previous.values, ...metric.values] : metric.values;
      const values = unavailableReason === undefined ? readings : [];
      combined[run.label][key] = { ...metric, values, unavailableReason };
    }
  }
  const result = {};
  const mainKeys = Object.keys(combined.main);
  const currentKeys = Object.keys(combined.current);
  const keys = new Set([...mainKeys, ...currentKeys]);
  for (const key of keys) {
    const before = combined.main[key];
    const after = combined.current[key];
    if (before === undefined || after === undefined) {
      throw new Error(`Unpaired metric ${key}`);
    }
    if (before.unit !== after.unit) throw new Error(`Incompatible units for ${key}`);
    const unavailableReason = before.unavailableReason ?? after.unavailableReason;
    if (unavailableReason !== undefined) {
      const baseline = before.unavailableReason === undefined ? summarize(before.values) : null;
      const current = after.unavailableReason === undefined ? summarize(after.values) : null;
      result[key] = { unit: after.unit, baseline, current, delta: null, percent: null, verdict: 'unavailable', unavailableReason };
      continue;
    }
    const comparison = compareMetric(before.values, after.values, { thresholdPercent, higherIsBetter: after.higherIsBetter });
    if (after.informational) comparison.verdict = 'context';
    result[key] = { displayName: after.displayName, unit: after.unit, ...comparison };
  }
  return result;
}

function readable(value) {
  const precision = value.toPrecision(4);
  const rounded = Number(precision);
  return String(rounded);
}

export function markdown(report) {
  const lines = ['# Local list performance comparison', '', `Base: \`${report.sources.main.commit}\``, `Current: \`${report.sources.current.commit}\` (${report.sources.current.sourceHash})`, `Suite: \`${report.suiteHash}\``, '', 'Values are medians; ± is median absolute deviation. Verdicts use a heuristic noise band, not statistical significance.', ''];
  for (const [platform, data] of Object.entries(report.platforms)) {
    lines.push(`## ${platform}: ${data.device.name}`, '', '| Metric | Main | Current | Change | Verdict |', '| --- | ---: | ---: | ---: | --- |');
    for (const [key, metric] of Object.entries(data.comparison)) {
      if (metric.verdict === 'unavailable') {
        lines.push(`| ${key} (${metric.unit}) | n/a | n/a | n/a | unavailable: ${metric.unavailableReason} |`);
        continue;
      }
      const percent = metric.percent === null ? 'n/a' : `${metric.percent.toFixed(1)}%`;
      const before = `${readable(metric.baseline.median)} ± ${readable(metric.baseline.mad)}`;
      const after = `${readable(metric.current.median)} ± ${readable(metric.current.mad)}`;
      const scenario = key.split('/')[0];
      const label = metric.displayName ? `${scenario}/${metric.displayName}` : key;
      lines.push(`| ${label} (${metric.unit}) | ${before} | ${after} | ${readable(metric.delta)} (${percent}) | ${metric.verdict} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
