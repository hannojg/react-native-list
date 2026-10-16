# Local performance comparisons

Connect one physical iPhone and one physical Android device, unlock both, and run:

```sh
git fetch origin
PERF_IOS_TEAM=<your-Apple-team-ID> bun perf compare
```

The default base is the **locally resolved `origin/main` commit**. The runner does
not fetch automatically. The candidate includes the current checkout's tracked
changes and untracked, non-ignored files. Your checkout, index and branch stay in
place. Commit submodule changes before running.

The runner snapshots both sources into temporary checkouts, installs each
revision's locked dependency versions, and builds optimized apps with embedded bundles.
It supplies the same benchmark app, native marker module, tests and chat fixture
to both revisions, including a base that predates this harness. These files have
a shared SHA-256 fingerprint in the report. The library and its dependencies come
from their respective revisions.

Both builds receive the same generated Metro 0.84.5 / Metro Runtime 0.84.5
Worklets patches. Their contents are part of the suite fingerprint. Bun updates
the isolated lockfiles' patch metadata before the frozen install and verifies
that the locked package graph stayed identical. This also lets
the suite build a base from before those patches landed.

All builds finish before measurements start. Each platform runs
`main → current → current → main`. Every block runs mount and scroll tests, each
with one discarded warm-up and five measured repetitions. iOS launches once per
scenario, then unmounts the list and waits for native removal between repetitions.
Its CPU/memory/hitch metrics stay bound to that live app process. Android restarts
the app between repetitions and clears app data between blocks. This benchmark app has
no persistent state or network dependencies. Platforms run sequentially, and
their results are compared separately.

## Requirements

- Apple Silicon Mac, full Xcode 27+ selected with `xcode-select`, Bun 1.4+, Node 22.13+,
  CocoaPods and the `xcodeproj` Ruby gem.
- Paired iPhone with **iOS 26+**, Developer Mode enabled, and a configured Apple
  development team/signing identity. Xcode may need to register the device and
  create provisioning profiles on the first build.
- Physical Android device with **API 31+**, authorized USB debugging, Android
  SDK/NDK and JDK configured as for the example app. `adb` must be on PATH.
- Keep power/refresh-rate settings, orientation, charging state and background
  activity consistent. Disable Low Power/Battery Saver and avoid interacting
  with either device during the suite. Close profilers and screen mirroring.

The comparison command rejects simulators/emulators and ambiguous device
selection. Native tests reject thermally constrained runs and incomplete
workloads. They do not lock CPU frequencies or eliminate all OS variation.

## Commands

```sh
# One platform, or explicit devices when several are connected
bun perf compare --platform android --android-device <serial>
PERF_IOS_TEAM=<team> bun perf compare --platform ios --ios-device <UDID>

# Repeat balanced blocks, choose another base, keep builds for investigation
bun perf compare --base <commit-or-ref> --rounds 2 --keep-builds

# Also execute the iOS scrolling test under Instruments Time Profiler
PERF_IOS_TEAM=<team> bun perf compare --profile

# Compile without launching devices; simulator compilation is not a benchmark
bun perf build --platform android
bun perf build --platform ios --simulator

# Verify snapshot safety, metric parsing and comparison behaviour
bun run test:perf
```

`--ios-team` is equivalent to `PERF_IOS_TEAM`. `--threshold` sets the practical
percentage threshold (default 5%). `--output` selects a **new** output directory;
the default is `.perf/results/<timestamp>`. `build` retains its temporary
checkouts. `compare` removes them unless `--keep-builds` is provided, retaining
logs and partial native results when a run fails. It never publishes results.
The iOS app and test bundle IDs include the development team ID, so contributors
can provision them independently.

## Scenarios and measurements

The workload is the existing deterministic 10,000-message chat fixture, with
variable text heights and reaction chips, rendered by a shared benchmark screen.
Font scaling is disabled and list top/bottom insets are zero. Fixture preparation happens before the
mount trigger.

- **Mount:** start a native `ListMount` signpost/async trace immediately before
  React is asked to construct the list. End when the first native viewport has
  visible cells covering its height. The readiness probe runs only during mount,
  once per display callback. This is viewport layout readiness, with display-tick
  granularity; it is not a measurement of pixels reaching the panel. Datasource
  construction and initial binding are included.
- **Scroll:** mount first, then perform six native fast upward gestures (Android:
  swipes at 6,000 px/s, waiting for idle between gestures). Verify the list moved more than one
  viewport and advanced past the initial item. Initial scroll position is reset
  by mounting a new list each repetition.

iOS uses XCTest's target-app CPU, physical-memory growth and peak, scrolling FPS/frame
metrics and hitch metrics. The mount marker isolates the mount duration from
automation overhead; CPU/memory cover the measured interaction. Memory growth
and peak physical memory are reported separately. Raw measurements are in the
`.xcresult` bundle and exported JSON.

Android uses Macrobenchmark 1.5.0, fixed full ART compilation, frame deadline
overruns and anonymous RSS sampled maxima. Custom `TraceMetric` queries use
Perfetto scheduler data to report CPU time summed across cores, and app
FrameTimeline data for jank/drop counts. Per-iteration `cpu-threads` JSON files
retain CPU time, native names and IDs for each active thread. They are stored
separately so changing thread names cannot make Macrobenchmark drop iterations. Each
frame distribution contributes one P95 value per iteration to the comparison.
Memory counters and frame classifications must be present; missing required
metrics invalidate the run.

The small Perfetto configuration records scheduler, app markers, FrameTimeline
and process memory data, with explicit buffers and 250 ms memory polling. Trace
data loss invalidates the iteration rather than silently undercounting CPU or frames.

Android `interactionPresentedFps` is presented app surface frames divided by the
whole measured interaction's duration, including automation pauses. It is context,
not animation-only FPS; deadline overruns and jank drive the smoothness comparison.
Frame counts and classification coverage are also context, not optimization scores.

These platform metrics have different definitions. iOS hitches are not Android
janky frames; anonymous RSS is not iOS physical footprint. Results never compare
one platform's values against the other.

## Results and interpretation

`manifest.json` records source hashes, device identity, suite fingerprint and run
configuration. A successful comparison writes `comparison.json`,
`comparison.md`, and per-platform run JSON, alongside native results and logs.
Every metric retains all original repetitions. Android per-iteration traces are
copied with the test output. An incomplete run does not produce a successful
comparison report.

The report compares medians, reports median absolute deviation (MAD), and labels
changes within the practical threshold **unchanged**. Larger differences within
three times the larger MAD are **inconclusive**; remaining differences are
**improved** or **regressed**. This is a conservative heuristic, not statistical
significance. A zero baseline retains its absolute delta and has no percentage.
Use repeated unchanged-source comparisons to establish useful device-specific
thresholds before relying on these labels. The command exits nonzero on an
execution/measurement error; regression labels are reported in JSON/Markdown.

`--profile` makes a separate Instruments recording for each iOS build after
benchmarking. The runner waits for Instruments' tracing-start notification before
starting XCUITest. Open `profile.trace` in Instruments and filter to `ListPerf`
for per-thread CPU samples and stacks. The recording is system-wide so it can
capture the app across fresh process launches. Profile timings never enter the
benchmark comparison. Android already records per-thread scheduling data and
Perfetto traces during every block. This harness adds no process resource
sampler, analytics SDK or Mobile Dev dependency.

Sources: [XCTest performance tests](https://developer.apple.com/documentation/xcode/writing-and-running-performance-tests),
[Macrobenchmark](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview),
[FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline).
