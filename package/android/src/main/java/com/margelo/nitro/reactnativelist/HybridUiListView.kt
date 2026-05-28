package com.margelo.nitro.reactnativelist

import android.graphics.Color
import android.graphics.Canvas
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.ReactActivity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.interfaces.fabric.ReactSurface
import com.facebook.react.runtime.ReactSurfaceView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.margelo.nitro.NitroModules
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference

typealias CreateViewCallbackType = (
    type: String
) -> Double
typealias UpdateViewCallbackType = (
    reactTag: Double,
    item: NativeListItem,
    index: Double
) -> Boolean

class HybridUiListView(val reactContext: ThemedReactContext) :
    HybridUiListViewSpec(),
    NativeListDataSourceObserver {
    private var createViewCallback: CreateViewCallbackType? = null
    private var updateViewCallback: UpdateViewCallbackType? = null
    private var adapter: NativeListAdapter? = null
    private var dataSource: HybridNativeListDataSource? = null
    private var isRecyclerViewLayoutScheduled = false
    private var rendererSurface: ReactSurface? = null
    private var rendererSurfaceId: Int? = null
    private var isRendererSurfaceStarted = false
    private var isDisposed = false
    private val debugId = nextDebugId()
    private var activeCreateNativeViewCount = 0
    private var nextCreateNativeViewSequence = 1

    override val view: RecyclerView by lazy {
        ClippedRecyclerView(reactContext).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            layoutManager = LinearLayoutManager(reactContext)
            setBackgroundColor(Color.TRANSPARENT)
        }
    }

    override fun setListCallbacks(
        uiListModule: HybridUiListModuleSpec,
        createView: CreateViewCallbackType,
        updateView: UpdateViewCallbackType
    ) {
        Log.d(USER_DEBUG_TAG, "list#$debugId setListCallbacks")
        isDisposed = false
        createViewCallback = createView
        updateViewCallback = updateView
        runOnMain {
            ensureAdapter()
        }
    }

    override fun getSurfaceId(): Double {
        val surfaceId = runOnMainSync {
            ensureRendererSurface()
        }
        Log.d(USER_DEBUG_TAG, "list#$debugId getSurfaceId surfaceId=$surfaceId")
        return surfaceId.toDouble()
    }

    override fun disposeRendererSurface() {
        runOnMainSync {
            Log.d(USER_DEBUG_TAG, "list#$debugId disposeRendererSurface")
            isDisposed = true
            createViewCallback = null
            updateViewCallback = null
            dataSource?.observer = null
            dataSource = null
            adapter?.dataSource = null
            adapter = null
            // setAdapter(null) asks RecyclerView to recycle attached holders immediately.
            // During list teardown the whole native view is going away, so drop the adapter
            // without entering RecyclerView's recycling path.
            view.swapAdapter(null, false)
            view.layoutManager?.removeAllViews()
            isRecyclerViewLayoutScheduled = false

            val surface = rendererSurface
            rendererSurface = null
            rendererSurfaceId = null
            isRendererSurfaceStarted = false

            if (surface == null) {
                return@runOnMainSync
            }

            surface.stop()
            surface.clear()
            surface.detach()
        }
    }

    override fun onDropView() {
        disposeRendererSurface()
        super.onDropView()
    }

    override fun setDataSource(dataSource: HybridNativeListDataSourceSpec) {
        val nativeDataSource = dataSource as? HybridNativeListDataSource
            ?: throw IllegalStateException("NativeListDataSource must be created by react-native-list.")

        runOnMain {
            val existingDataSource = this.dataSource
            if (existingDataSource === nativeDataSource) {
                Log.w("HybridUiListView", "setDataSource called with the same data source instance. Ignoring.")
                Log.d(USER_DEBUG_TAG, "list#$debugId setDataSource ignored same instance count=${nativeDataSource.getCountAsInt()}")
                return@runOnMain
            }

            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId setDataSource count=${nativeDataSource.getCountAsInt()} existing=${existingDataSource != null} adapter=${adapter != null}"
            )
            this.dataSource?.observer = null
            this.dataSource = nativeDataSource
            nativeDataSource.observer = this
            val nativeAdapter = ensureAdapter()
            nativeAdapter.dataSource = nativeDataSource
            nativeAdapter.retainMeasuredContent(nativeDataSource)
            nativeAdapter.notifyDataSetChanged()
            scheduleRecyclerViewLayout()
        }
    }

    override fun setLayout(layout: HybridNativeListLayoutSpec) {
        val layoutProvider = layout as? NativeListLayoutProvider
            ?: throw IllegalStateException("NativeListLayout must provide a platform layout.")

        runOnMain {
            Log.d(USER_DEBUG_TAG, "list#$debugId setLayout")
            layoutProvider.applyTo(view, reactContext)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidReload(diffResult: DiffUtil.DiffResult?, animated: Boolean) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            val nativeDataSource = dataSource
            val count = nativeDataSource?.getCountAsInt()
            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId dataSourceDidReload animated=$animated hasDiff=${diffResult != null} count=$count"
            )
            if (nativeDataSource != null) {
                nativeAdapter.retainMeasuredContent(nativeDataSource)
            }

            if (!animated || diffResult == null) {
                nativeAdapter.notifyDataSetChanged()
                scheduleRecyclerViewLayout()
                return@runOnMain
            }

            diffResult.dispatchUpdatesTo(nativeAdapter)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidInsert(index: Int) {
        runOnMain {
            Log.d(USER_DEBUG_TAG, "list#$debugId dataSourceDidInsert index=$index")
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemInserted(index)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidUpdate(index: Int, previousItem: NativeListItem) {
        runOnMain {
            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId dataSourceDidUpdate index=$index previousKey=${previousItem.key}"
            )
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemChanged(index)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidRemove(index: Int, removedItem: NativeListItem) {
        runOnMain {
            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId dataSourceDidRemove index=$index removedKey=${removedItem.key}"
            )
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemRemoved(index)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidMove(fromIndex: Int, toIndex: Int) {
        runOnMain {
            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId dataSourceDidMove fromIndex=$fromIndex toIndex=$toIndex"
            )
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemMoved(fromIndex, toIndex)
            scheduleRecyclerViewLayout()
        }
    }

    private fun ensureAdapter(): NativeListAdapter {
        if (isDisposed) {
            throw IllegalStateException("Cannot create adapter after list was disposed.")
        }

        val existingAdapter = adapter
        if (existingAdapter != null) {
            return existingAdapter
        }

        Log.d(USER_DEBUG_TAG, "list#$debugId ensureAdapter create dataSource=${dataSource != null}")
        val nativeAdapter = NativeListAdapter(
            reactContext = reactContext,
            createView = { type ->
                createNativeView(type)
            },
            updateView = { reactTag, item, index ->
                val capturedCallback = updateViewCallback
                    ?: throw IllegalStateException("UpdateView callback is not set.")
                capturedCallback(reactTag, item, index)
            }
        )
        nativeAdapter.dataSource = dataSource
        adapter = nativeAdapter
        attachAdapterIfRendererReady()
        return nativeAdapter
    }

    private fun attachAdapterIfRendererReady() {
        val nativeAdapter = adapter
            ?: return

        val surfaceId = rendererSurfaceId
        if (surfaceId != null && !isRendererSurfaceStarted) {
            Log.d(USER_DEBUG_TAG, "list#$debugId attachAdapter deferred surfaceId=$surfaceId rendererStarted=false")
            return
        }

        val currentAdapter = view.adapter
        if (currentAdapter === nativeAdapter) {
            return
        }

        view.adapter = nativeAdapter
        Log.d(USER_DEBUG_TAG, "list#$debugId attachAdapter attached surfaceId=$surfaceId")
    }

    private fun ensureRendererSurface(): Int {
        val existingSurfaceId = rendererSurfaceId
        if (existingSurfaceId != null) {
            return existingSurfaceId
        }

        val context: ReactApplicationContext = NitroModules.applicationContext
            ?: throw IllegalStateException("ReactApplicationContext is null! Is Nitro installed?")
        val reactActivity = context.currentActivity as? ReactActivity
            ?: throw IllegalStateException("Current activity is not a ReactActivity!")
        val reactHost = reactActivity.reactActivityDelegate.reactHost
            ?: throw IllegalStateException("ReactNativeHost is null!")

        val surface = reactHost.createSurface(reactContext, "", null)
        val surfaceView = surface.view as? ReactSurfaceView
            ?: throw IllegalStateException("Surface view is not a ReactSurfaceView!")
        val surfaceId = surfaceView.getRootViewTag()

        rendererSurface = surface
        rendererSurfaceId = surfaceId
        isRendererSurfaceStarted = false
        isDisposed = false

        Log.d(USER_DEBUG_TAG, "list#$debugId ensureRendererSurface start surfaceId=$surfaceId")
        val startTask = surface.start()
        val waitThread = Thread {
            try {
                startTask.waitForCompletion()
                view.post {
                    val startError = startTask.getError()
                    if (startError != null) {
                        throw startError
                    }

                    if (isDisposed) {
                        Log.d(USER_DEBUG_TAG, "list#$debugId renderer surface start ignored disposed surfaceId=$surfaceId")
                        return@post
                    }

                    val currentSurfaceId = rendererSurfaceId
                    if (currentSurfaceId != surfaceId) {
                        Log.d(USER_DEBUG_TAG, "list#$debugId renderer surface start ignored stale surfaceId=$surfaceId current=$currentSurfaceId")
                        return@post
                    }

                    isRendererSurfaceStarted = true
                    Log.d(USER_DEBUG_TAG, "list#$debugId renderer surface start completed surfaceId=$surfaceId")
                    attachAdapterIfRendererReady()
                    scheduleRecyclerViewLayout()
                }
            } catch (throwable: Throwable) {
                view.post {
                    throw throwable
                }
            }
        }
        waitThread.name = "UiListSurfaceStart-$surfaceId"
        waitThread.start()
        Log.d(USER_DEBUG_TAG, "list#$debugId ensureRendererSurface after start surfaceId=$surfaceId")

        return surfaceId
    }

    private fun createNativeView(type: String): View {
        if (isDisposed) {
            throw IllegalStateException("Cannot create view after list was disposed.")
        }

        val capturedCallback = createViewCallback
            ?: throw IllegalStateException("CreateView callback is not set.")

        val sequence = nextCreateNativeViewSequence
        nextCreateNativeViewSequence += 1
        activeCreateNativeViewCount += 1
        Log.d(
            USER_DEBUG_TAG,
            "list#$debugId createNativeView#$sequence start type=$type activeCreates=$activeCreateNativeViewCount thread=${Thread.currentThread().name}"
        )
        val viewTag = capturedCallback(type).toInt()
        Log.d(
            USER_DEBUG_TAG,
            "list#$debugId createNativeView#$sequence callback returned type=$type viewTag=$viewTag activeCreates=$activeCreateNativeViewCount thread=${Thread.currentThread().name}"
        )
        val fabricUiManager = UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC)
            ?: throw IllegalStateException("Fabric UIManager is null. Is Fabric enabled?")

        val resolvedView = fabricUiManager.resolveView(viewTag)
            ?: throw IllegalStateException("Could not resolve view with tag $viewTag.")

        val parent = resolvedView.parent as? ViewGroup
            ?: throw IllegalStateException("View with tag $viewTag has no parent.")
        val childIndex = parent.indexOfChild(resolvedView)
        parent.removeViewAt(childIndex)

        if (resolvedView.parent != null) {
            throw IllegalStateException("View with tag $viewTag still has a parent after removing.")
        }

        parent.addView(View(reactContext), childIndex)

        Log.d(
            USER_DEBUG_TAG,
            "list#$debugId createNativeView#$sequence finish type=$type viewTag=$viewTag parentChildIndex=$childIndex activeCreates=$activeCreateNativeViewCount thread=${Thread.currentThread().name}"
        )
        activeCreateNativeViewCount -= 1
        return resolvedView
    }

    private fun scheduleRecyclerViewLayout() {
        val surfaceId = rendererSurfaceId
        if (surfaceId != null && !isRendererSurfaceStarted) {
            Log.d(USER_DEBUG_TAG, "list#$debugId scheduleRecyclerViewLayout deferred surfaceId=$surfaceId rendererStarted=false")
            return
        }

        if (isRecyclerViewLayoutScheduled) {
            Log.d(USER_DEBUG_TAG, "list#$debugId scheduleRecyclerViewLayout skipped already scheduled")
            return
        }

        isRecyclerViewLayoutScheduled = true
        Log.d(USER_DEBUG_TAG, "list#$debugId scheduleRecyclerViewLayout posted")
        view.post {
            isRecyclerViewLayoutScheduled = false
            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId scheduleRecyclerViewLayout run activeCreates=$activeCreateNativeViewCount thread=${Thread.currentThread().name}"
            )
            performRecyclerViewLayoutIfReady()
        }
    }

    private fun performRecyclerViewLayoutIfReady() {
        val viewWidth = view.width
        val viewHeight = view.height
        if (!view.isAttachedToWindow || viewWidth <= 0 || viewHeight <= 0) {
            Log.d(
                USER_DEBUG_TAG,
                "list#$debugId performRecyclerViewLayoutIfReady skipped attached=${view.isAttachedToWindow} size=${viewWidth}x$viewHeight"
            )
            return
        }

        // React Native has already assigned bounds, but RecyclerView requestLayout()
        // is not always traversed from this Fabric-hosted view. Drive RecyclerView's
        // pending adapter updates with the current RN layout.
        val widthSpec = View.MeasureSpec.makeMeasureSpec(viewWidth, View.MeasureSpec.EXACTLY)
        val heightSpec = View.MeasureSpec.makeMeasureSpec(viewHeight, View.MeasureSpec.EXACTLY)
        Log.d(
            USER_DEBUG_TAG,
            "list#$debugId performRecyclerViewLayoutIfReady measure-layout size=${viewWidth}x$viewHeight adapterCount=${adapter?.itemCount} activeCreates=$activeCreateNativeViewCount thread=${Thread.currentThread().name}"
        )
        view.measure(widthSpec, heightSpec)
        view.layout(view.left, view.top, view.right, view.bottom)
        Log.d(USER_DEBUG_TAG, "list#$debugId performRecyclerViewLayoutIfReady finish")
    }

    private fun runOnMain(block: () -> Unit) {
        val isMainThread = Looper.myLooper() == Looper.getMainLooper()
        if (isMainThread) {
            block()
        } else {
            view.post(block)
        }
    }

    private fun <T> runOnMainSync(block: () -> T): T {
        val isMainThread = Looper.myLooper() == Looper.getMainLooper()
        if (isMainThread) {
            return block()
        }

        val result = AtomicReference<Result<T>>()
        val latch = CountDownLatch(1)
        view.post {
            try {
                val value = block()
                result.set(Result.success(value))
            } catch (throwable: Throwable) {
                result.set(Result.failure(throwable))
            } finally {
                latch.countDown()
            }
        }
        latch.await()
        val capturedResult = result.get()
            ?: throw IllegalStateException("UI thread did not return a result.")
        return capturedResult.getOrThrow()
    }

    private class ClippedRecyclerView(context: ThemedReactContext) : RecyclerView(context) {
        override fun dispatchDraw(canvas: Canvas) {
            // RN/Fabric parents may allow child drawing outside their bounds.
            // Keep clipToPadding=false for list insets, but clip rows to the list viewport.
            // Without this item could overflow the list bounds.
            val saveCount = canvas.save()
            canvas.clipRect(0, 0, width, height)
            super.dispatchDraw(canvas)
            canvas.restoreToCount(saveCount)
        }
    }

    companion object {
        private const val USER_DEBUG_TAG = "UserDebug"
        private var debugIdCounter = 1

        private fun nextDebugId(): Int {
            val debugId = debugIdCounter
            debugIdCounter += 1
            return debugId
        }
    }
}
