package com.hannojg.list.perf.tests

import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.TraceMetric
import androidx.benchmark.traceprocessor.TraceProcessor
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

@OptIn(ExperimentalMetricApi::class)
class CpuMetric(private val scenario: String) : TraceMetric() {
  private var iteration = 0
  override fun getMeasurements(captureInfo: CaptureInfo, traceSession: TraceProcessor.Session): List<Measurement> {
    val lossQuery = "SELECT name, value FROM stats WHERE severity = 'data_loss' AND value > 0"
    val lossRows = traceSession.query(lossQuery)
    val losses = lossRows.toList()
    val lossless = losses.isEmpty()
    check(lossless) { "Perfetto lost trace data; CPU/frame measurements are invalid: $losses" }
    val query = """
      WITH bounds AS (
        SELECT ts, ts + dur AS end FROM slice WHERE name = 'ListInteraction' AND dur > 0
      )
      SELECT thread.tid AS tid, COALESCE(thread.name, 'unnamed') AS name,
        SUM(MIN(sched.ts + sched.dur, bounds.end) - MAX(sched.ts, bounds.ts)) / 1000000.0 AS ms
      FROM sched JOIN thread USING (utid) JOIN process USING (upid), bounds
      WHERE process.name = '${captureInfo.targetPackageName}' AND sched.dur > 0
        AND sched.ts < bounds.end AND sched.ts + sched.dur > bounds.ts
      GROUP BY thread.utid, thread.tid, thread.name
    """.trimIndent()
    val queryRows = traceSession.query(query)
    val rows = queryRows.toList()
    val populated = rows.isNotEmpty()
    check(populated) { "Missing CPU scheduling data" }
    val threads = JSONArray()
    var total = 0.0
    for (row in rows) {
      val time = row.double("ms")
      val name = row.string("name")
      val thread = JSONObject()
      val tid = row.long("tid")
      thread.put("tid", tid)
      thread.put("name", name)
      thread.put("cpuMs", time)
      threads.put(thread)
      total += time
    }
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val parent = instrumentation.context.getExternalFilesDir(null)
    check(parent != null) { "Test artifact directory unavailable" }
    val directory = File(parent, "cpu-threads")
    if (directory.exists() == false) {
      val created = directory.mkdirs()
      check(created)
    }
    val document = JSONObject()
    document.put("scenario", scenario)
    document.put("iteration", iteration)
    document.put("cpuTimeMs", total)
    document.put("threads", threads)
    val file = File(directory, "$scenario-$iteration.json")
    val text = document.toString(2)
    file.writeText(text)
    iteration += 1
    // Dynamic thread names must not become metric names: Macrobenchmark drops
    // iterations whose set of single-value metrics differs from another run.
    val measurement = Measurement("cpuTimeMs", total)
    return listOf(measurement)
  }
}

@OptIn(ExperimentalMetricApi::class)
class FrameStatsMetric : TraceMetric() {
  override fun getMeasurements(captureInfo: CaptureInfo, traceSession: TraceProcessor.Session): List<Measurement> {
    val query = """
      WITH bounds AS (
        SELECT ts, ts + dur AS end FROM slice WHERE name = 'ListInteraction' AND dur > 0
      )
      SELECT MAX(bounds.end - bounds.ts) AS elapsedNs,
        SUM(CASE WHEN present_type IN ('On-time Present', 'Late Present', 'Early Present')
        THEN 1 ELSE 0 END) AS frames,
        SUM(CASE WHEN present_type = 'Dropped Frame' THEN 1 ELSE 0 END) AS dropped,
        SUM(CASE WHEN present_type IN ('On-time Present', 'Late Present', 'Early Present')
          AND jank_type IS NOT NULL AND jank_type NOT LIKE '%Unknown%'
          AND jank_type NOT IN ('', 'Unspecified')
          THEN 1 ELSE 0 END) AS classified,
        SUM(CASE WHEN present_type IN ('On-time Present', 'Late Present', 'Early Present')
          AND jank_type IS NOT NULL AND jank_type NOT LIKE '%Unknown%'
          AND jank_type NOT IN ('None', '', 'Unspecified', 'Non Animating', 'Display not ON')
          THEN 1 ELSE 0 END) AS janky
      FROM actual_frame_timeline_slice JOIN process USING (upid), bounds
      WHERE process.name = '${captureInfo.targetPackageName}' AND dur > 0
        AND actual_frame_timeline_slice.ts >= bounds.ts
        AND actual_frame_timeline_slice.ts + dur <= bounds.end
    """.trimIndent()
    val rows = traceSession.query(query)
    val row = rows.single()
    val frames = row.long("frames")
    val classified = row.long("classified")
    check(frames > 0) { "Missing app FrameTimeline data" }
    val dropped = row.long("dropped")
    val janky = row.long("janky")
    val elapsed = row.long("elapsedNs")
    check(elapsed > 0)
    val frameCount = frames.toDouble()
    val droppedCount = dropped.toDouble()
    val classifiedCount = classified.toDouble()
    val jankyCount = janky.toDouble()
    val frameMetric = Measurement("presentedSurfaceFrames", frameCount)
    val dropMetric = Measurement("droppedFrames", droppedCount)
    // Export counts even at zero coverage; the report must not score partial jank data.
    val classifiedMetric = Measurement("classifiedSurfaceFrames", classifiedCount)
    val jankMetric = Measurement("jankyClassifiedFrames", jankyCount)
    val coverageMetric = Measurement("classificationCoveragePercent", classified * 100.0 / frames)
    val fpsMetric = Measurement("interactionPresentedFps", frameCount * 1_000_000_000.0 / elapsed)
    return listOf(frameMetric, dropMetric, classifiedMetric, jankMetric, coverageMetric, fpsMetric)
  }
}
