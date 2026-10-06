"""Rebuild slide 29's comparison from the supplied Android recordings."""

import json
import math
from pathlib import Path
from statistics import mean


SCRIPT_PATH = Path(__file__)
RESOLVED_SCRIPT_PATH = SCRIPT_PATH.resolve()
PRESENTATION = RESOLVED_SCRIPT_PATH.parents[1]
ASSETS = PRESENTATION / "assets" / "benchmarks"
FRAME_BUDGET_MS = 1000 / 60
SCROLL_START_CUT_SECONDS = 1


def weighted_average(samples, key, start, end):
    total = 0
    weight = 0
    for sample in samples:
        value = sample[key]
        if value is None:
            continue
        interval_start = max(start, sample["time"] - sample["interval"])
        interval_end = min(end, sample["time"])
        overlap = max(0, interval_end - interval_start)
        total += value * overlap
        weight += overlap
    if weight == 0:
        raise ValueError(f"No {key} samples in scrolling window")
    return total / weight


def summarize(name):
    source = ASSETS / f"{name}.json"
    text = source.read_text()
    recording = json.loads(text)
    segments = []
    segment = []
    for sample in recording["fps"]["samples"]:
        timeline = sample.get("frameTimeline")
        if timeline is None:
            raise ValueError("Comparison requires FrameTimeline data")
        anchor = int(timeline["intervalEndNs"])
        for frame in timeline["frames"]:
            end_ns = int(frame["endTimeNs"])
            time = sample["time"] + (end_ns - anchor) / 1e9
            if segment and time - segment[-1][0] > 0.3:
                segments.append(segment)
                segment = []
            segment.append((time, frame))
    if segment:
        segments.append(segment)
    scroll = max(segments, key=len)
    scroll_start = scroll[0][0]
    start = scroll_start + SCROLL_START_CUT_SECONDS
    end = scroll[-1][0] + 0.000001
    intervals = []
    timed_intervals = []
    buckets = {}
    legacy_points = [[0, 0]]
    legacy = 0
    previous = None
    dropped = 0
    presented = 0
    for time, frame in scroll:
        if time < start:
            continue
        kind = frame["presentType"]
        if kind == 4:
            dropped += 1
            continue
        if kind not in (1, 2, 3):
            previous = None
            continue
        presented += 1
        presentation = int(frame["endTimeNs"])
        if previous is not None and presentation > previous:
            interval = (presentation - previous) / 1e6
            intervals.append(interval)
            timed_intervals.append([time - start, interval])
            bucket_index = math.floor(time - start)
            bucket = buckets.setdefault(bucket_index, [])
            bucket.append(interval)
            slots = math.floor(interval / FRAME_BUDGET_MS + 0.5)
            missed = max(0, slots - 1)
            if missed > 0:
                legacy += missed
                legacy_points.append([time - start, legacy])
        previous = presentation
    interval_count = len(intervals)
    average_interval = mean(intervals)
    legacy_points.append([end - start, legacy])
    series = {"fps": [], "frameInterval": [], "legacy": legacy_points, "cpu": [], "memory": []}
    for bucket_index, bucket in buckets.items():
        bucket_start = bucket_index
        bucket_end = min(bucket_index + 1, end - start)
        midpoint = (bucket_start + bucket_end) / 2
        bucket_mean = mean(bucket)
        series["fps"].append([midpoint, 1000 / bucket_mean])
        series["frameInterval"].append([midpoint, bucket_mean])
    for sample in recording["samples"]:
        if sample["time"] < start or sample["time"] >= end:
            continue
        relative_time = sample["time"] - start
        if sample["cpuPercent"] is not None:
            series["cpu"].append([relative_time, sample["cpuPercent"]])
        if sample["memoryBytes"] is not None:
            memory_mib = sample["memoryBytes"] / 1048576
            series["memory"].append([relative_time, memory_mib])
    cpu = weighted_average(recording["samples"], "cpuPercent", start, end)
    rss = weighted_average(recording["samples"], "memoryBytes", start, end)
    progress = [{"time": 0, "fps": None, "frameInterval": None, "cpu": None, "memory": None, "legacy": 0}]
    duration = end - start
    steps = math.ceil(duration)
    for step in range(1, steps + 1):
        elapsed = min(step, duration)
        prefix_intervals = [interval for time, interval in timed_intervals if time <= elapsed]
        prefix_mean = mean(prefix_intervals)
        prefix_cpu = weighted_average(recording["samples"], "cpuPercent", start, start + elapsed)
        prefix_memory = weighted_average(recording["samples"], "memoryBytes", start, start + elapsed)
        prefix_legacy = 0
        for time, count in legacy_points:
            if time <= elapsed:
                prefix_legacy = count
        progress.append({"time": elapsed, "fps": 1000 / prefix_mean, "frameInterval": prefix_mean,
                         "cpu": prefix_cpu, "memory": prefix_memory / 1048576, "legacy": prefix_legacy})
    return {
        "id": recording["id"],
        "device": recording["deviceName"],
        "bundleId": recording["target"]["bundleId"],
        "scrollRange": {"start": scroll_start, "end": end},
        "excludedStartSeconds": SCROLL_START_CUT_SECONDS,
        "range": {"start": start, "end": end},
        "duration": end - start,
        "fps": 1000 / average_interval,
        "frameInterval": average_interval,
        "cpu": cpu,
        "memory": rss / 1048576,
        "dropped": dropped,
        "legacy": legacy,
        "presentedFrames": presented,
        "intervalCount": interval_count,
        "series": series,
        "progress": progress,
    }


def smooth_path(points):
    slopes = []
    for first, second in zip(points, points[1:]):
        slopes.append((second[1] - first[1]) / (second[0] - first[0]))
    tangents = [slopes[0]]
    for previous, following in zip(slopes, slopes[1:]):
        if previous * following > 0:
            tangent = 2 * previous * following / (previous + following)
        else:
            tangent = 0
        tangents.append(tangent)
    tangents.append(slopes[-1])
    x, y = points[0]
    commands = [f"M{x:.2f},{y:.2f}"]
    for index, (first, second) in enumerate(zip(points, points[1:])):
        x0, y0 = first
        x1, y1 = second
        third = (x1 - x0) / 3
        low = min(y0, y1)
        high = max(y0, y1)
        control0 = y0 + tangents[index] * third
        control1 = y1 - tangents[index + 1] * third
        control0 = max(low, control0)
        control0 = min(high, control0)
        control1 = max(low, control1)
        control1 = min(high, control1)
        commands.append(f"C{x0 + third:.2f},{control0:.2f} {x1 - third:.2f},{control1:.2f} {x1:.2f},{y1:.2f}")
    return " ".join(commands)


def metric_chart(key, title, direction, unit, decimals, minimum, maximum, ticks, runs):
    chart_heights = {"frameInterval": 165, "fps": 100, "cpu": 100, "memory": 205}
    chart_height = chart_heights[key]
    reserved_height = 48 if key == "frameInterval" else 12
    plot_bottom = chart_height - reserved_height
    plot_height = plot_bottom - 8
    paths = []
    labels = []
    accessible = []
    for name, label in [("rnl", "RNL"), ("flashlist", "FlashList")]:
        value = runs[name][key]
        formatted = f"{value:.{decimals}f}"
        accessible.append(f"{label}: {formatted} {unit}")
        drop_total = ""
        if key == "frameInterval":
            drop_total = f'<small class="benchmark-drop-total"> · <b data-benchmark-value="legacy" data-run="{name}" data-decimals="0">0</b> drops</small>'
        labels.append(f'<span class="benchmark-{name}"><b data-benchmark-value="{key}" data-run="{name}" data-decimals="{decimals}">—</b><small>{unit}</small>{drop_total}</span>')
        points = []
        for time, reading in runs[name]["series"][key]:
            x = 65 + time / 31 * 924
            y = plot_bottom - (reading - minimum) / (maximum - minimum) * plot_height
            points.append([x, y])
        path = smooth_path(points)
        clip_id = f"benchmark-clip-{key}-{name}"
        paths.append(f'<defs><clipPath id="{clip_id}"><rect x="65" y="0" width="0" height="{chart_height}" data-benchmark-reveal="{name}"/></clipPath></defs><path class="benchmark-line benchmark-{name}" clip-path="url(#{clip_id})" d="{path}"/>')
        if key == "frameInterval":
            lane_y = chart_height - 28 if name == "rnl" else chart_height - 12
            paths.append(f'<circle class="benchmark-drop-owner benchmark-{name}" cx="53" cy="{lane_y}" r="4"/><path class="benchmark-drop-lane" d="M65,{lane_y}H989"/>')
            previous_count = 0
            for time, count in runs[name]["series"]["legacy"]:
                missed = count - previous_count
                previous_count = count
                if missed == 0:
                    continue
                x = 65 + time / 31 * 924
                paths.append(f'<path class="benchmark-drop-mark" data-drop-run="{name}" data-drop-count="{missed}" clip-path="url(#{clip_id})" d="M{x - 3.5:.2f},{lane_y - 3.5}L{x + 3.5:.2f},{lane_y + 3.5}M{x - 3.5:.2f},{lane_y + 3.5}L{x + 3.5:.2f},{lane_y - 3.5}"><title>{label}: {missed} estimated missed 60 Hz slot at {time:.3f} s</title></path>')
    grid = []
    for tick in ticks:
        y = plot_bottom - (tick - minimum) / (maximum - minimum) * plot_height
        grid.append(f'<path class="benchmark-grid" d="M65,{y:.2f}H989"/><text x="51" y="{y + 7:.2f}" text-anchor="end">{tick:g}</text>')
    for tick in [0, 10, 20, 30]:
        x = 65 + tick / 31 * 924
        grid.append(f'<path class="benchmark-grid benchmark-time-grid" d="M{x:.2f},8V{plot_bottom}"/>')
    grid_markup = "\n          ".join(grid)
    paths_markup = "\n          ".join(paths)
    if key == "frameInterval":
        paths_markup += '\n          <text class="benchmark-drop-key" x="989" y="22" text-anchor="end">× frame drops / jank</text>'
    if key == "memory":
        rnl_memory = runs["rnl"]["memory"]
        flashlist_memory = runs["flashlist"]["memory"]
        difference_percent = (flashlist_memory - rnl_memory) / flashlist_memory * 100
        rnl_y = plot_bottom - (rnl_memory - minimum) / (maximum - minimum) * plot_height
        flashlist_y = plot_bottom - (flashlist_memory - minimum) / (maximum - minimum) * plot_height
        paths_markup += f'''\n          <g class="benchmark-memory-gap" data-memory-gap hidden>
            <path class="benchmark-average-line benchmark-rnl" d="M65,{rnl_y:.2f}H974"/>
            <path class="benchmark-average-line benchmark-flashlist" d="M65,{flashlist_y:.2f}H974"/>
            <text x="989" y="25" text-anchor="end">{difference_percent:.1f}% lower average RSS</text>
          </g>'''
    labels_markup = "".join(labels)
    values = "; ".join(accessible)
    return f'''<figure class="benchmark-metric benchmark-metric-{key}" aria-label="{title} over selected scrolling time. Selected-window values: {values}">
        <figcaption><strong>{title}<small>{direction}</small></strong><span class="benchmark-summary">{labels_markup}</span></figcaption>
        <svg class="benchmark-plot" viewBox="0 0 997 {chart_height}" role="img" aria-label="{title} timeline; horizontal axis is seconds since the selected window started; vertical axis is {unit}">
          {grid_markup}
          {paths_markup}
        </svg>
      </figure>'''


def main():
    runs = {}
    for name in ["rnl", "flashlist"]:
        runs[name] = summarize(name)
    report = json.dumps(runs, indent=2)
    summary = ASSETS / "comparison.json"
    summary.write_text(report + "\n")
    metrics = [
        ("frameInterval", "Average frame interval", "↓ lower is better", "ms", 2, 16, 18.2, [16, 17, 18]),
        ("fps", "Average frame rate", "↑ higher is better", "fps", 2, 50, 65, [50, 60]),
        ("cpu", "CPU", "100% = one CPU core", "%", 1, 0, 200, [0, 100, 200]),
        ("memory", "Memory · RSS", "↓ lower is better", "MiB", 0, 500, 750, [500, 600, 700, 750]),
    ]
    charts = []
    for metric in metrics:
        chart = metric_chart(*metric, runs)
        charts.append(chart)
    content = "\n      ".join(charts)
    playback_data = {}
    for name, run in runs.items():
        playback_data[name] = {"duration": run["duration"], "progress": run["progress"], "legacy": run["series"]["legacy"]}
    playback_json = json.dumps(playback_data, separators=(",", ":"))
    content += f'\n      <script type="application/json" id="benchmark-playback-data">{playback_json}</script>'
    index = PRESENTATION / "index.html"
    html = index.read_text()
    opening = "<!-- shop-benchmark-metrics:start -->"
    closing = "<!-- shop-benchmark-metrics:end -->"
    before, remainder = html.split(opening, 1)
    old, after = remainder.split(closing, 1)
    html = f"{before}{opening}\n      {content}\n      {closing}{after}"
    index.write_text(html)
    for name, run in runs.items():
        print(f"{name}: {run['fps']:.2f} FPS, {run['legacy']} legacy drops, {run['frameInterval']:.4f} ms average interval")


if __name__ == "__main__":
    main()
