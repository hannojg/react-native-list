package com.hannojg.listbenchmark

import android.os.PowerManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.Trace
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ListBenchmarkModule : Module(), Choreographer.FrameCallback {
  private var startedAt = 0L
  private var result: Map<String, Any>? = null
  private var completion: Promise? = null
  private var failure: String? = null
  private var tracing = false
  private var waitingForUnmount = false
  private val mainLooper = Looper.getMainLooper()
  private val mainHandler = Handler(mainLooper)

  override fun definition() = ModuleDefinition {
    Name("ListBenchmark")

    AsyncFunction("beginMount") {
      waitingForUnmount = false
      startedAt = SystemClock.elapsedRealtime()
      result = null
      failure = null
      Trace.beginAsyncSection("ListMount", 1)
      tracing = true
      val choreographer = Choreographer.getInstance()
      choreographer.postFrameCallback(this@ListBenchmarkModule)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("waitForUnmount") { promise: Promise ->
      waitingForUnmount = true
      startedAt = SystemClock.elapsedRealtime()
      completion = promise
      val choreographer = Choreographer.getInstance()
      choreographer.postFrameCallback(this@ListBenchmarkModule)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("waitForMount") { promise: Promise ->
      val snapshot = result
      val error = failure
      if (snapshot != null) {
        promise.resolve(snapshot)
      } else if (error != null) {
        promise.reject("ERR_MOUNT", error, null)
      } else {
        completion = promise
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("snapshot") {
      val list = findList() ?: error("List missing")
      snapshot(list)
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      mainHandler.post {
        finish()
      }
    }
  }

  private fun findList(view: View): RecyclerView? {
    if (view is RecyclerView) return view
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        val child = view.getChildAt(index)
        val list = findList(child)
        if (list != null) return list
      }
    }
    return null
  }

  private fun findList(): RecyclerView? {
    val root = appContext.currentActivity?.window?.decorView ?: return null
    return findList(root)
  }

  private fun snapshot(list: RecyclerView): Map<String, Any> {
    val layout = list.layoutManager as LinearLayoutManager
    val first = layout.findFirstVisibleItemPosition()
    val last = layout.findLastVisibleItemPosition()
    val offset = list.computeVerticalScrollOffset()
    val manager = list.context.getSystemService(PowerManager::class.java)
    return mapOf(
      "first" to first, "last" to last, "offset" to offset,
      "viewport" to list.height, "thermal" to manager.currentThermalStatus
    )
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (SystemClock.elapsedRealtime() - startedAt > 20_000) {
      val message = "List readiness timed out after 20 seconds (unmount: $waitingForUnmount)"
      failure = message
      completion?.reject("ERR_MOUNT", message, null)
      finish()
      return
    }
    val list = findList()
    if (waitingForUnmount) {
      if (list == null) {
        completion?.resolve(null)
        finish()
      } else {
        val choreographer = Choreographer.getInstance()
        choreographer.postFrameCallback(this)
      }
      return
    }
    if (list != null && list.height > 0 && list.childCount > 0 && !list.isComputingLayout) {
      val firstChild = list.getChildAt(0)
      val lastChild = list.getChildAt(list.childCount - 1)
      val layout = list.layoutManager as LinearLayoutManager
      val first = layout.findFirstVisibleItemPosition()
      if (first == 0 && firstChild.top <= 1 && lastChild.bottom >= list.height - 1) {
        result = snapshot(list)
        completion?.resolve(result)
        finish()
        return
      }
    }
    val choreographer = Choreographer.getInstance()
    choreographer.postFrameCallback(this)
  }

  private fun finish() {
    if (tracing) Trace.endAsyncSection("ListMount", 1)
    tracing = false
    completion = null
    val choreographer = Choreographer.getInstance()
    choreographer.removeFrameCallback(this)
  }
}
