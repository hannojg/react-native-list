package com.margelo.nitro.reactnativelist

import android.graphics.Color
import android.graphics.Canvas
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import androidx.annotation.Keep
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference

typealias CreateViewCallbackType = (
    type: String,
    surfaceId: Double
) -> Double
typealias UpdateViewCallbackType = (
    reactTag: Double,
    item: NativeListItem,
    index: Double
) -> Boolean

@DoNotStrip
@Keep
class HybridUiListView(val reactContext: ThemedReactContext) :
    HybridUiListViewSpec(),
    NativeListDataSourceObserver {
    private var createViewCallback: CreateViewCallbackType? = null
    private var updateViewCallback: UpdateViewCallbackType? = null
    private var adapter: NativeListAdapter? = null
    private var dataSource: HybridNativeListDataSource? = null
    private var isRecyclerViewLayoutScheduled = false
    private var itemContentInsets = ItemContentInsets(horizontal = 0, vertical = 0)
    private val rendererSurfaces = mutableMapOf<Int, RendererSurface>()
    private var disposeViewCallback: ((Double) -> Boolean)? = null
    private var isDisposed = false

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
        updateView: UpdateViewCallbackType,
        disposeView: (Double) -> Boolean
    ) {
        isDisposed = false
        createViewCallback = createView
        updateViewCallback = updateView
        disposeViewCallback = disposeView
        runOnMain {
            ensureAdapter()
        }
    }

    override fun disposeRendererSurface() {
        runOnMainSync {
            if (isDisposed) return@runOnMainSync
            isDisposed = true
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

            val tags = rendererSurfaces.keys.toList()
            for (tag in tags) releaseNativeView(tag)
            view.recycledViewPool.clear()
            createViewCallback = null
            updateViewCallback = null
            disposeViewCallback = null
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
                return@runOnMain
            }

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
            itemContentInsets = layoutProvider.itemContentInsets(reactContext)
            val nativeAdapter = adapter
            if (nativeAdapter != null) {
                nativeAdapter.itemContentInsets = itemContentInsets
                nativeAdapter.notifyDataSetChanged()
            }
            layoutProvider.applyTo(view, reactContext)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidReload(diffResult: DiffUtil.DiffResult?, animated: Boolean) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            val nativeDataSource = dataSource
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
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemInserted(index)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidUpdate(index: Int, previousItem: NativeListItem) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemChanged(index)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidRemove(index: Int, removedItem: NativeListItem) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.notifyItemRemoved(index)
            scheduleRecyclerViewLayout()
        }
    }

    override fun dataSourceDidMove(fromIndex: Int, toIndex: Int) {
        runOnMain {
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
        nativeAdapter.itemContentInsets = itemContentInsets
        nativeAdapter.dataSource = dataSource
        adapter = nativeAdapter
        view.setRecycledViewPool(HolderPool { tag -> releaseNativeView(tag) })
        view.adapter = nativeAdapter
        return nativeAdapter
    }

    private fun createNativeView(type: String): HostedItemView {
        if (isDisposed) {
            throw IllegalStateException("Cannot create view after list was disposed.")
        }

        val capturedCallback = createViewCallback
            ?: throw IllegalStateException("CreateView callback is not set.")

        val surface = RendererSurface(reactContext)
        val surfaceId = surface.surfaceId.toDouble()
        try {
            val rawTag = capturedCallback(type, surfaceId)
            val viewTag = rawTag.toInt()
            val fabricUiManager = UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC)
                ?: throw IllegalStateException("Fabric UIManager is null. Is Fabric enabled?")
            val resolvedView = fabricUiManager.resolveView(viewTag)
                ?: throw IllegalStateException("Could not resolve view with tag $viewTag.")
            rendererSurfaces[viewTag] = surface
            return HostedItemView(surface.view, resolvedView, viewTag)
        } catch (error: Throwable) {
            disposeViewCallback?.invoke(surfaceId)
            surface.stop()
            throw error
        }
    }

    private fun scheduleRecyclerViewLayout() {
        if (isRecyclerViewLayoutScheduled) {
            return
        }

        isRecyclerViewLayoutScheduled = true
        view.post {
            isRecyclerViewLayoutScheduled = false
            performRecyclerViewLayoutIfReady()
        }
    }

    private fun performRecyclerViewLayoutIfReady() {
        val viewWidth = view.width
        val viewHeight = view.height
        if (!view.isAttachedToWindow || viewWidth <= 0 || viewHeight <= 0) {
            return
        }

        // React Native has already assigned bounds, but RecyclerView requestLayout()
        // is not always traversed from this Fabric-hosted view. Drive RecyclerView's
        // pending adapter updates with the current RN layout.
        val widthSpec = View.MeasureSpec.makeMeasureSpec(viewWidth, View.MeasureSpec.EXACTLY)
        val heightSpec = View.MeasureSpec.makeMeasureSpec(viewHeight, View.MeasureSpec.EXACTLY)
        view.measure(widthSpec, heightSpec)
        view.layout(view.left, view.top, view.right, view.bottom)
    }

    private fun releaseNativeView(reactTag: Int) {
        val surface = rendererSurfaces.remove(reactTag) ?: return
        try {
            disposeViewCallback?.invoke(surface.surfaceId.toDouble())
        } finally {
            surface.stop()
        }
    }

    // RecyclerView has no holder-destruction callback. Pool admission/eviction is the
    // ownership boundary: cached holders retain their roots, discarded holders release them.
    private class HolderPool(val release: (Int) -> Unit) : RecyclerView.RecycledViewPool() {
        private val pooled = mutableSetOf<NativeListAdapter.ViewHolder>()

        override fun putRecycledView(scrap: RecyclerView.ViewHolder) {
            val holder = scrap as NativeListAdapter.ViewHolder
            val type = holder.itemViewType
            val before = getRecycledViewCount(type)
            super.putRecycledView(scrap)
            if (getRecycledViewCount(type) > before) {
                pooled.add(holder)
            } else {
                holder.reactTag?.let(release)
            }
        }

        override fun getRecycledView(viewType: Int): RecyclerView.ViewHolder? {
            val holder = super.getRecycledView(viewType)
            pooled.remove(holder)
            return holder
        }

        override fun clear() {
            for (holder in pooled) holder.reactTag?.let(release)
            pooled.clear()
            super.clear()
        }

        override fun setMaxRecycledViews(viewType: Int, max: Int) {
            // Retire the bucket explicitly rather than letting RecyclerView silently drop roots.
            while (true) {
                val holder = getRecycledView(viewType) as? NativeListAdapter.ViewHolder ?: break
                holder.reactTag?.let(release)
            }
            super.setMaxRecycledViews(viewType, max)
        }
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

}
