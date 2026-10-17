# Per-holder Fabric surfaces comparison

Measured on 17 October 2026 with React Native 0.86.2 and Expo SDK 57.

The deterministic 10,000-message chat benchmark compares `966a066b1ca56710ebc4af23e4e8124f4fe70ac4`
(main) with `ca526767ae84cdb7875527385ccae0069a029079` (per-holder surfaces).
Both apps use optimized Release builds with embedded bundles. Each platform runs
main → candidate → candidate → main, with five measured iterations per scenario
in each block: ten samples per revision for mounting and scrolling. All eight
native scenario tests passed on each platform.

The Android device is a Samsung SM-G977B running Android 12 / API 31. The iOS
device is an iPhone 17 Pro running iOS 27.0.1. Measurements are compared within
each platform; their CPU and memory definitions differ.

## Results

Values are medians ± median absolute deviation (MAD). The suite's practical
threshold is 5%. Larger differences inside three times the larger MAD are
inconclusive. These verdicts are heuristics, not statistical significance tests.

| Platform / metric | Main | Per-holder surfaces | Change | Verdict |
| --- | ---: | ---: | ---: | --- |
| Android mount duration (ms) | 203.5 ± 6.456 | 205.7 ± 2.955 | +1.1% | unchanged |
| Android mount CPU (ms) | 446.0 ± 8.255 | 464.3 ± 4.922 | +4.1% | unchanged |
| Android scroll CPU (ms) | 3,883 ± 27.06 | 3,947 ± 101.7 | +1.7% | unchanged |
| Android scroll anonymous RSS (KiB) | 83,840 ± 242 | 83,340 ± 198 | -0.6% | unchanged |
| Android scroll frame CPU P95 (ms) | 9.753 ± 2.435 | 7.719 ± 0.1774 | -20.9% | inconclusive |
| iOS mount duration (ms) | 60.47 ± 0.3295 | 61.15 ± 0.7171 | +1.1% | unchanged |
| iOS mount CPU (ms) | 165.3 ± 1.517 | 170.0 ± 0.6313 | +2.8% | unchanged |
| iOS scroll CPU (ms) | 1,749 ± 8.921 | 1,786 ± 8.328 | +2.1% | unchanged |
| iOS scroll peak physical memory (kB) | 56,080 ± 1,253 | 62,340 ± 6,119 | +11.2% | inconclusive |

This workload shows no demonstrated speedup or clear timing/CPU regression.
The higher iOS memory median and its variability do not establish memory
equivalence. The result does not cover every list workload or React Native version.

## Measurement limits

- Some Android frames contain `Unknown Jank`. The revised collector retains
  presented/classified/janky-classified counts even with zero coverage. The
  report withholds the entire jank comparison when any measured iteration is
  incompletely classified, while retaining other valid measurements. Median
  classification coverage was 95.91% for main and 100% for the candidate.
- Android frame-overrun P95 changed from -0.013 ± 7.797 ms to -7.576 ± 0.1409 ms,
  an inconclusive result. Percentage changes are not useful near a zero baseline.
- XCTest exported zero animation frame counts despite nonzero frame-rate
  measurements. This comparison does not establish a smoothness improvement.
- Earlier incomplete Android attempts are excluded. The user identified a missed
  installation approval dialog; the successful run kept the same full ART
  compilation and device security settings, with manual installation approvals.

## Provenance and reproduction

The library app APKs were unchanged when the Android classification collector
was rebuilt. Both revisions used byte-identical benchmark test APKs. All builds
finished before measurement. Both Android builds used a process-local Gradle
metaspace limit of 2 GiB after the default 512 MiB failed during release lint;
this did not change app runtime configuration.

- iOS suite SHA-256: `2d718d412e194531f7e506354afba4550cb1a51695c05b24636a6a0ea6d21ef4`.
- Android revised suite SHA-256: `f0d74ab825570caddbe27f696e19aa72598abd0bb0a2362b1fd1dc6d1ff170a2`.
- Main source SHA-256: `a8db7eaa5aeaa0ce5e2fe1c0b06d5699c7cea46a3483dfa301d85ace98423dfc`.
- Candidate source SHA-256: `1e189151ff22b86e835932466d9d0465e32726dbf45c9040df849eb1933c515a`.
  The candidate snapshot includes pre-existing untracked presentation/editor
  files; these are not benchmark runtime inputs.

Raw measurements, native traces, test bundles and manifests remain in the local
ignored `.perf/results/2026-10-17T13-57-58.245Z/` directory. Completed Android runs
are under `android-dialog-approved/`; completed iOS runs are under `ios/`.
`android-comparison.json` and `ios-comparison.json` retain all samples and verdicts.
Large traces and device-specific build artifacts are not committed.

See [the runner instructions](../README.md) to reproduce the comparison. The
checked-in summary records the measured runtime commits, not later documentation
or reporting-only commits on the branch.
