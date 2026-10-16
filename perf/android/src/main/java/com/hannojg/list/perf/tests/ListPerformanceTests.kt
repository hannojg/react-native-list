package com.hannojg.list.perf.tests

import android.os.Trace
import androidx.benchmark.ExperimentalBenchmarkConfigApi
import androidx.benchmark.ExperimentalConfig
import androidx.benchmark.perfetto.ExperimentalPerfettoCaptureApi
import androidx.benchmark.perfetto.PerfettoConfig
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MemoryUsageMetric
import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@OptIn(ExperimentalMetricApi::class, ExperimentalBenchmarkConfigApi::class, ExperimentalPerfettoCaptureApi::class)
@RunWith(AndroidJUnit4::class)
class ListPerformanceTests {
  @get:Rule val benchmark = MacrobenchmarkRule()
  private val packageName = "com.hannojg.list.perf"

  private fun interaction(block: () -> Unit) {
    Trace.beginAsyncSection("ListInteraction", 1)
    try {
      block()
    } finally {
      Trace.endAsyncSection("ListInteraction", 1)
    }
  }

  private fun configuration(): ExperimentalConfig {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val stream = instrumentation.context.assets.open("list-perf.pbtxt")
    val reader = stream.bufferedReader()
    val text = reader.use { it.readText() }
    val perfetto = PerfettoConfig.Text(text)
    return ExperimentalConfig(perfettoConfig = perfetto)
  }

  private fun MacrobenchmarkScope.element(id: String): UiObject2 {
    val selector = By.res(id)
    val condition = Until.hasObject(selector)
    val exists = device.wait(condition, 30_000)
    check(exists) { "Missing $id" }
    return device.findObject(selector)
  }

  private fun MacrobenchmarkScope.state(id: String): JSONObject {
    val element = element(id)
    val state = JSONObject(element.contentDescription)
    val thermal = state.getInt("thermal")
    check(thermal < 3) { "Device is thermally constrained" }
    return state
  }

  private fun MacrobenchmarkScope.mount() {
    val button = element("perf-mount")
    button.click()
    val snapshot = state("perf-mounted")
    val first = snapshot.getInt("first")
    val last = snapshot.getInt("last")
    check(first == 0)
    check(last > 0)
  }

  @Test fun mount() {
    val mountMetric = TraceSectionMetric("ListMount", TraceSectionMetric.Mode.First)
    val cpu = CpuMetric("mount")
    val memoryTypes = listOf(MemoryUsageMetric.SubMetric.RssAnon)
    val memory = MemoryUsageMetric(MemoryUsageMetric.Mode.Max, memoryTypes)
    val metrics = listOf(mountMetric, cpu, memory)
    val compilation = CompilationMode.Full()
    val configuration = configuration()
    benchmark.measureRepeated(
      packageName = packageName,
      metrics = metrics,
      compilationMode = compilation,
      startupMode = StartupMode.WARM,
      iterations = 5,
      experimentalConfig = configuration,
      setupBlock = {
        killProcess()
        startActivityAndWait()
        element("perf-ready")
      },
    ) {
      interaction {
        mount()
      }
    }
  }

  @Test fun scroll() {
    val frames = FrameTimingMetric()
    val cpu = CpuMetric("scroll")
    val frameStats = FrameStatsMetric()
    val memoryTypes = listOf(MemoryUsageMetric.SubMetric.RssAnon)
    val memory = MemoryUsageMetric(MemoryUsageMetric.Mode.Max, memoryTypes)
    val metrics = listOf(frames, cpu, frameStats, memory)
    val compilation = CompilationMode.Full()
    val configuration = configuration()
    benchmark.measureRepeated(
      packageName = packageName,
      metrics = metrics,
      compilationMode = compilation,
      startupMode = StartupMode.WARM,
      iterations = 5,
      experimentalConfig = configuration,
      setupBlock = {
        killProcess()
        startActivityAndWait()
        element("perf-ready")
        mount()
      },
    ) {
      interaction {
        val selector = By.scrollable(true)
        val list = device.findObject(selector)
        check(list != null) { "RecyclerView missing" }
        val margin = list.visibleBounds.width() / 5
        list.setGestureMargin(margin)
        repeat(6) {
          list.swipe(Direction.UP, 0.9f, 6_000)
          device.waitForIdle()
        }
        val button = element("perf-inspect")
        button.click()
        val snapshot = state("perf-inspected")
        val first = snapshot.getInt("first")
        val offset = snapshot.getInt("offset")
        val viewport = snapshot.getInt("viewport")
        assertTrue("Scroll did not advance", first > 0)
        assertTrue(offset > viewport)
      }
    }
  }
}
