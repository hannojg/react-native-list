package com.margelo.nitro.reactnativelist

import android.graphics.Color
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import kotlin.math.roundToInt

typealias CreateViewCallbackType = (
    type: String
) -> Double
typealias UpdateViewCallbackType = (
    reactTag: Double,
    item: NativeListItem,
    index: Double
) -> Boolean

internal interface NativeListDataSourceObserver {
    fun dataSourceDidReload(diffResult: DiffUtil.DiffResult?, animated: Boolean)
    fun dataSourceDidInsert(index: Int)
    fun dataSourceDidUpdate(index: Int, previousItem: NativeListItem)
    fun dataSourceDidRemove(index: Int, removedItem: NativeListItem)
    fun dataSourceDidMove(fromIndex: Int, toIndex: Int)
}

class HybridNativeListDataSource : HybridNativeListDataSourceSpec() {
    internal var observer: NativeListDataSourceObserver? = null
    private var items: List<NativeListItem> = emptyList()
    private var isContentEqual: (oldItem: NativeListItem, newItem: NativeListItem) -> Boolean =
        { _, _ -> false }

    override fun setContentEqualCallback(
        isContentEqual: (oldItem: NativeListItem, newItem: NativeListItem) -> Boolean
    ) {
        this.isContentEqual = isContentEqual
    }

    override fun replaceData(items: Array<NativeListItem>, animated: Boolean) {
        val nextItems = items.toList()
        if (!animated) {
            this.items = nextItems
            observer?.dataSourceDidReload(null, false)
            return
        }

        val previousItems = this.items
        val callback = NativeDiffCallback(previousItems, nextItems, isContentEqual)
        val diffResult = DiffUtil.calculateDiff(callback, true)
        this.items = nextItems
        observer?.dataSourceDidReload(diffResult, true)
    }

    override fun insertItem(index: Double, item: NativeListItem) {
        val itemIndex = validateInsertionIndex(index.toInt())
        val mutableItems = items.toMutableList()
        mutableItems.add(itemIndex, item)
        items = mutableItems
        observer?.dataSourceDidInsert(itemIndex)
    }

    override fun updateItem(index: Double, item: NativeListItem) {
        val itemIndex = validateExistingIndex(index.toInt())
        val mutableItems = items.toMutableList()
        val previousItem = mutableItems[itemIndex]
        mutableItems[itemIndex] = item
        items = mutableItems
        observer?.dataSourceDidUpdate(itemIndex, previousItem)
    }

    override fun removeItem(index: Double) {
        val itemIndex = validateExistingIndex(index.toInt())
        val mutableItems = items.toMutableList()
        val removedItem = mutableItems.removeAt(itemIndex)
        items = mutableItems
        observer?.dataSourceDidRemove(itemIndex, removedItem)
    }

    override fun moveItem(fromIndex: Double, toIndex: Double) {
        val sourceIndex = validateExistingIndex(fromIndex.toInt())
        val targetIndex = validateExistingIndex(toIndex.toInt())
        val mutableItems = items.toMutableList()
        val item = mutableItems.removeAt(sourceIndex)
        mutableItems.add(targetIndex, item)
        items = mutableItems
        observer?.dataSourceDidMove(sourceIndex, targetIndex)
    }

    override fun getCount(): Double {
        return items.size.toDouble()
    }

    override fun getItem(index: Double): NativeListItem {
        val itemIndex = validateExistingIndex(index.toInt())
        return getItemAt(itemIndex)
    }

    internal fun getItemAt(index: Int): NativeListItem {
        return items[index]
    }

    internal fun getCountAsInt(): Int {
        return items.size
    }

    private fun validateExistingIndex(index: Int): Int {
        if (index < 0 || index >= items.size) {
            throw IndexOutOfBoundsException("List index $index is out of bounds.")
        }
        return index
    }

    private fun validateInsertionIndex(index: Int): Int {
        if (index < 0 || index > items.size) {
            throw IndexOutOfBoundsException("List index $index is out of bounds.")
        }
        return index
    }
}

private class NativeDiffCallback(
    private val oldItems: List<NativeListItem>,
    private val newItems: List<NativeListItem>,
    private val isContentEqual: (oldItem: NativeListItem, newItem: NativeListItem) -> Boolean
) : DiffUtil.Callback() {

    override fun getOldListSize(): Int {
        return oldItems.size
    }

    override fun getNewListSize(): Int {
        return newItems.size
    }

    override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
        val oldItem = oldItems[oldItemPosition]
        val newItem = newItems[newItemPosition]
        return oldItem.key == newItem.key && oldItem.type == newItem.type
    }

    override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
        val oldItem = oldItems[oldItemPosition]
        val newItem = newItems[newItemPosition]

        if (oldItem.width != newItem.width) {
            return false
        }
        if (oldItem.height != newItem.height) {
            return false
        }

        return isContentEqual(oldItem, newItem)
    }
}

open class HybridNativeListLayout : HybridNativeListLayoutSpec()

private interface NativeListLayoutProvider {
    fun applyTo(recyclerView: RecyclerView, reactContext: ThemedReactContext)
}

class HybridNativeLinearListLayout :
    HybridNativeLinearListLayoutSpec(),
    NativeListLayoutProvider {
    private var topInset = 16
    private var bottomInset = 16
    private var itemSpacing = 12

    override fun setConfig(config: NativeLinearListLayoutConfig) {
        topInset = config.topInset.roundToInt()
        bottomInset = config.bottomInset.roundToInt()
        itemSpacing = config.itemSpacing.roundToInt()
    }

    override fun applyTo(recyclerView: RecyclerView, reactContext: ThemedReactContext) {
        recyclerView.layoutManager = LinearLayoutManager(reactContext)
        recyclerView.clipToPadding = false
        val density = reactContext.resources.displayMetrics.density
        val topPadding = (topInset * density).roundToInt()
        val bottomPadding = (bottomInset * density).roundToInt()
        val spacing = (itemSpacing * density).roundToInt()

        while (recyclerView.itemDecorationCount > 0) {
            recyclerView.removeItemDecorationAt(0)
        }

        recyclerView.setPadding(0, topPadding, 0, bottomPadding)
        recyclerView.addItemDecoration(LinearSpacingDecoration(spacing))
    }
}

private class LinearSpacingDecoration(
    private val itemSpacing: Int
) : RecyclerView.ItemDecoration() {
    override fun getItemOffsets(
        outRect: android.graphics.Rect,
        view: View,
        parent: RecyclerView,
        state: RecyclerView.State
    ) {
        val position = parent.getChildAdapterPosition(view)
        val itemCount = state.itemCount
        if (position >= 0 && position < itemCount - 1) {
            outRect.bottom = itemSpacing
        }
    }
}

class HybridUiListView(val reactContext: ThemedReactContext) :
    HybridUiListViewSpec(),
    NativeListDataSourceObserver {

    private var createViewCallback: CreateViewCallbackType? = null
    private var updateViewCallback: UpdateViewCallbackType? = null
    private var adapter: NativeListAdapter? = null
    private var dataSource: HybridNativeListDataSource? = null

    override val view: RecyclerView by lazy {
        RecyclerView(reactContext).apply {
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
        createViewCallback = createView
        updateViewCallback = updateView
        runOnMain {
            ensureAdapter()
        }
    }

    override fun setDataSource(dataSource: HybridNativeListDataSourceSpec) {
        val nativeDataSource = dataSource as? HybridNativeListDataSource
            ?: throw IllegalStateException("NativeListDataSource must be created by react-native-list.")

        runOnMain {
            this.dataSource?.observer = null
            this.dataSource = nativeDataSource
            nativeDataSource.observer = this
            val nativeAdapter = ensureAdapter()
            nativeAdapter.dataSource = nativeDataSource
            nativeAdapter.retainHostedContent(nativeDataSource)
            nativeAdapter.notifyDataSetChanged()
        }
    }

    override fun setLayout(layout: HybridNativeListLayoutSpec) {
        val layoutProvider = layout as? NativeListLayoutProvider
            ?: throw IllegalStateException("NativeListLayout must provide a platform layout.")

        runOnMain {
            layoutProvider.applyTo(view, reactContext)
        }
    }

    override fun dataSourceDidReload(diffResult: DiffUtil.DiffResult?, animated: Boolean) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            val nativeDataSource = dataSource
            if (nativeDataSource != null) {
                nativeAdapter.retainHostedContent(nativeDataSource)
            }

            if (!animated || diffResult == null) {
                nativeAdapter.notifyDataSetChanged()
                return@runOnMain
            }

            diffResult.dispatchUpdatesTo(nativeAdapter)
        }
    }

    override fun dataSourceDidInsert(index: Int) {
        runOnMain {
            ensureAdapter().notifyItemInserted(index)
        }
    }

    override fun dataSourceDidUpdate(index: Int, previousItem: NativeListItem) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            val nativeDataSource = dataSource
            val nextItem = nativeDataSource?.getItemAt(index)
            if (nextItem == null || previousItem.key != nextItem.key) {
                nativeAdapter.releaseHostedContent(previousItem.key)
            }
            nativeAdapter.notifyItemChanged(index)
        }
    }

    override fun dataSourceDidRemove(index: Int, removedItem: NativeListItem) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.releaseHostedContent(removedItem.key)
            nativeAdapter.notifyItemRemoved(index)
        }
    }

    override fun dataSourceDidMove(fromIndex: Int, toIndex: Int) {
        runOnMain {
            ensureAdapter().notifyItemMoved(fromIndex, toIndex)
        }
    }

    private fun ensureAdapter(): NativeListAdapter {
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
        nativeAdapter.dataSource = dataSource
        adapter = nativeAdapter
        view.adapter = nativeAdapter
        return nativeAdapter
    }

    private fun createNativeView(type: String): View {
        val capturedCallback = createViewCallback
            ?: throw IllegalStateException("CreateView callback is not set.")

        val viewTag = capturedCallback(type).toInt()
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

        return resolvedView
    }

    private fun runOnMain(block: () -> Unit) {
        val isMainThread = Looper.myLooper() == Looper.getMainLooper()
        if (isMainThread) {
            block()
        } else {
            view.post(block)
        }
    }

    private class NativeListAdapter(
        private val reactContext: ThemedReactContext,
        private val createView: (type: String) -> View,
        private val updateView: (reactTag: Double, item: NativeListItem, index: Double) -> Boolean
    ) : RecyclerView.Adapter<NativeListAdapter.ViewHolder>() {

        var dataSource: HybridNativeListDataSource? = null
        private val viewTypeByItemType = mutableMapOf<String, Int>()
        private val itemTypeByViewType = mutableMapOf<Int, String>()
        private val measuredContentSizeByType = mutableMapOf<String, PixelSize>()
        private var nextViewType = 1

        class ViewHolder(val container: FrameLayout) : RecyclerView.ViewHolder(container) {
            var boundType: String? = null
            var boundKey: String? = null
            var reactTag: Int? = null
        }

        private data class HostedContent(
            val view: View,
            val reactTag: Int,
            val type: String
        )

        private data class PixelSize(
            val width: Int?,
            val height: Int?
        )

        private data class ResolvedPixelSize(
            val width: Int,
            val height: Int
        )

        private val hostedContentByItemKey = mutableMapOf<String, HostedContent>()

        override fun getItemViewType(position: Int): Int {
            val item = requireDataSource().getItemAt(position)
            val existingViewType = viewTypeByItemType[item.type]
            if (existingViewType != null) {
                return existingViewType
            }

            val viewType = nextViewType
            nextViewType += 1
            viewTypeByItemType[item.type] = viewType
            itemTypeByViewType[viewType] = item.type
            return viewType
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val container = FrameLayout(parent.context)
            container.layoutParams = RecyclerView.LayoutParams(
                RecyclerView.LayoutParams.WRAP_CONTENT,
                RecyclerView.LayoutParams.WRAP_CONTENT
            )
            return ViewHolder(container)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = requireDataSource().getItemAt(position)
            val child = installHostedContent(holder, item)
            captureMeasuredContentSize(item.type, child)
            val contentSize = resolvedContentSize(item)
            bindContainerLayout(holder.container, contentSize)
            bindChildLayout(child, contentSize)

            val reactTag = holder.reactTag
            if (reactTag != null) {
                updateView(reactTag.toDouble(), item, position.toDouble())
            }
        }

        override fun getItemCount(): Int {
            return dataSource?.getCountAsInt() ?: 0
        }

        fun releaseHostedContent(itemKey: String) {
            hostedContentByItemKey.remove(itemKey)
        }

        fun retainHostedContent(dataSource: HybridNativeListDataSource) {
            val activeKeys = mutableSetOf<String>()
            val itemCount = dataSource.getCountAsInt()
            for (index in 0 until itemCount) {
                val item = dataSource.getItemAt(index)
                activeKeys.add(item.key)
            }

            val iterator = hostedContentByItemKey.keys.iterator()
            while (iterator.hasNext()) {
                val itemKey = iterator.next()
                if (activeKeys.contains(itemKey)) {
                    continue
                }
                iterator.remove()
            }
        }

        private fun requireDataSource(): HybridNativeListDataSource {
            return dataSource ?: throw IllegalStateException("NativeListDataSource is not set.")
        }

        private fun installHostedContent(holder: ViewHolder, item: NativeListItem): View {
            val currentChild = firstHostedChild(holder)
            if (
                currentChild != null &&
                holder.boundKey == item.key &&
                holder.boundType == item.type
            ) {
                return currentChild
            }

            holder.container.removeAllViews()
            val previousKey = holder.boundKey
            if (previousKey != null && previousKey != item.key) {
                releaseHostedContent(previousKey)
            }

            val existingHostedContent = hostedContentByItemKey[item.key]
            val hostedContent = if (
                existingHostedContent != null &&
                existingHostedContent.type == item.type
            ) {
                existingHostedContent
            } else {
                val child = createView(item.type)
                val nextHostedContent = HostedContent(
                    view = child,
                    reactTag = child.id,
                    type = item.type
                )
                hostedContentByItemKey[item.key] = nextHostedContent
                nextHostedContent
            }

            val parent = hostedContent.view.parent as? ViewGroup
            parent?.removeView(hostedContent.view)

            holder.container.addView(hostedContent.view)
            holder.boundType = item.type
            holder.boundKey = item.key
            holder.reactTag = hostedContent.reactTag
            return hostedContent.view
        }

        private fun firstHostedChild(holder: ViewHolder): View? {
            if (holder.container.childCount == 0) {
                return null
            }
            return holder.container.getChildAt(0)
        }

        private fun captureMeasuredContentSize(type: String, view: View) {
            val existingSize = measuredContentSizeByType[type]
            val measuredWidth = positiveDimension(view.measuredWidth)
            val measuredHeight = positiveDimension(view.measuredHeight)
            val viewWidth = positiveDimension(view.width)
            val viewHeight = positiveDimension(view.height)
            val layoutWidth = positiveDimension(view.layoutParams?.width)
            val layoutHeight = positiveDimension(view.layoutParams?.height)
            val width = measuredWidth ?: viewWidth ?: layoutWidth
            val height = measuredHeight ?: viewHeight ?: layoutHeight

            val nextWidth = existingSize?.width ?: width
            val nextHeight = existingSize?.height ?: height
            if (nextWidth == null && nextHeight == null) {
                return
            }

            measuredContentSizeByType[type] = PixelSize(
                width = nextWidth,
                height = nextHeight
            )
        }

        private fun resolvedContentSize(item: NativeListItem): ResolvedPixelSize {
            val measuredSize = measuredContentSizeByType[item.type]
            val width = item.width?.let { toPixels(it) } ?: measuredSize?.width
            val height = item.height?.let { toPixels(it) } ?: measuredSize?.height

            if (width == null) {
                throw IllegalStateException(
                    "Missing width for item type '${item.type}'. " +
                        "Provide width from getItemSize or render a measurable shell."
                )
            }
            if (height == null) {
                throw IllegalStateException(
                    "Missing height for item type '${item.type}'. " +
                        "Provide height from getItemSize or render a measurable shell."
                )
            }

            return ResolvedPixelSize(width, height)
        }

        private fun bindContainerLayout(container: FrameLayout, contentSize: ResolvedPixelSize) {
            val layoutParams = container.layoutParams as? RecyclerView.LayoutParams
                ?: RecyclerView.LayoutParams(contentSize.width, contentSize.height)
            layoutParams.width = contentSize.width
            layoutParams.height = contentSize.height
            container.layoutParams = layoutParams
        }

        private fun bindChildLayout(child: View, contentSize: ResolvedPixelSize) {
            val layoutParams = FrameLayout.LayoutParams(contentSize.width, contentSize.height)
            child.layoutParams = layoutParams
        }

        private fun positiveDimension(value: Int?): Int? {
            if (value == null || value <= 0) {
                return null
            }
            return value
        }

        private fun toPixels(value: Double): Int {
            val density = reactContext.resources.displayMetrics.density
            val pixels = value * density
            val rounded = pixels.roundToInt()
            return rounded.coerceAtLeast(1)
        }
    }
}
