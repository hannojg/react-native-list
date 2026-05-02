package com.margelo.nitro.reactnativelist

import android.graphics.Color
import android.os.Looper
import android.util.Log
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
typealias IsContentEqualCallbackType = (
    oldItem: NativeListItem,
    newItem: NativeListItem
) -> Boolean

class HybridUiListView(val reactContext: ThemedReactContext) : HybridUiListViewSpec() {

    private var createViewCallback: CreateViewCallbackType? = null
    private var updateViewCallback: UpdateViewCallbackType? = null
    private var isContentEqualCallback: IsContentEqualCallbackType? = null
    private var adapter: NativeListAdapter? = null

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
        updateView: UpdateViewCallbackType,
        isContentEqual: IsContentEqualCallbackType
    ) {
        createViewCallback = createView
        updateViewCallback = updateView
        isContentEqualCallback = isContentEqual
        runOnMain {
            ensureAdapter()
        }
    }

    override fun setData(items: Array<NativeListItem>, animated: Boolean) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            val nextItems = items.toList()
            nativeAdapter.setData(nextItems, animated)
        }
    }

    override fun insertItem(index: Double, item: NativeListItem) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.insertItem(index.toInt(), item)
        }
    }

    override fun updateItem(index: Double, item: NativeListItem) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.updateItem(index.toInt(), item)
        }
    }

    override fun removeItem(index: Double) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.removeItem(index.toInt())
        }
    }

    override fun moveItem(fromIndex: Double, toIndex: Double) {
        runOnMain {
            val nativeAdapter = ensureAdapter()
            nativeAdapter.moveItem(fromIndex.toInt(), toIndex.toInt())
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
            },
            isContentEqual = contentEqual@ { oldItem, newItem ->
                val capturedCallback = isContentEqualCallback
                    ?: return@contentEqual false
                capturedCallback(oldItem, newItem)
            }
        )
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

        Log.d(
            "HybridUiListView",
            "Resolved view with tag $viewTag, size ${resolvedView.measuredWidth}x${resolvedView.measuredHeight}"
        )
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
        private val updateView: (reactTag: Double, item: NativeListItem, index: Double) -> Boolean,
        private val isContentEqual: (oldItem: NativeListItem, newItem: NativeListItem) -> Boolean
    ) : RecyclerView.Adapter<NativeListAdapter.ViewHolder>() {

        private val viewTypeByItemType = mutableMapOf<String, Int>()
        private val itemTypeByViewType = mutableMapOf<Int, String>()
        private var nextViewType = 1
        private var items: List<NativeListItem> = emptyList()

        class ViewHolder(val container: FrameLayout) : RecyclerView.ViewHolder(container) {
            var boundType: String? = null
            var reactTag: Int? = null
        }

        fun setData(nextItems: List<NativeListItem>, animated: Boolean) {
            if (!animated) {
                items = nextItems
                notifyDataSetChanged()
                return
            }

            val previousItems = items
            val callback = NativeDiffCallback(previousItems, nextItems, isContentEqual)
            val result = DiffUtil.calculateDiff(callback, true)
            items = nextItems
            result.dispatchUpdatesTo(this)
        }

        fun insertItem(index: Int, item: NativeListItem) {
            validateInsertionIndex(index)
            val mutableItems = items.toMutableList()
            mutableItems.add(index, item)
            items = mutableItems
            notifyItemInserted(index)
        }

        fun updateItem(index: Int, item: NativeListItem) {
            validateExistingIndex(index)
            val mutableItems = items.toMutableList()
            mutableItems[index] = item
            items = mutableItems
            notifyItemChanged(index)
        }

        fun removeItem(index: Int) {
            validateExistingIndex(index)
            val mutableItems = items.toMutableList()
            mutableItems.removeAt(index)
            items = mutableItems
            notifyItemRemoved(index)
        }

        fun moveItem(fromIndex: Int, toIndex: Int) {
            validateExistingIndex(fromIndex)
            validateExistingIndex(toIndex)
            val mutableItems = items.toMutableList()
            val item = mutableItems.removeAt(fromIndex)
            mutableItems.add(toIndex, item)
            items = mutableItems
            notifyItemMoved(fromIndex, toIndex)
        }

        override fun getItemViewType(position: Int): Int {
            val item = items[position]
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
            val item = items[position]
            bindContainerLayout(holder.container, item)

            if (holder.boundType != item.type || holder.container.childCount == 0) {
                holder.container.removeAllViews()
                val child = createView(item.type)
                bindChildLayout(child, item)
                holder.container.addView(child)
                holder.boundType = item.type
                holder.reactTag = child.id
            } else {
                val child = holder.container.getChildAt(0)
                bindChildLayout(child, item)
            }

            val reactTag = holder.reactTag
            if (reactTag != null) {
                updateView(reactTag.toDouble(), item, position.toDouble())
            }
        }

        override fun getItemCount(): Int {
            return items.size
        }

        private fun bindContainerLayout(container: FrameLayout, item: NativeListItem) {
            val width = toPixels(item.width)
            val height = toPixels(item.height)
            val layoutParams = container.layoutParams as? RecyclerView.LayoutParams
                ?: RecyclerView.LayoutParams(width, height)
            layoutParams.width = width
            layoutParams.height = height
            container.layoutParams = layoutParams
        }

        private fun bindChildLayout(child: View, item: NativeListItem) {
            val width = toPixels(item.width)
            val height = toPixels(item.height)
            val layoutParams = FrameLayout.LayoutParams(width, height)
            child.layoutParams = layoutParams
        }

        private fun toPixels(value: Double): Int {
            val density = reactContext.resources.displayMetrics.density
            val pixels = value * density
            val rounded = pixels.roundToInt()
            return rounded.coerceAtLeast(1)
        }

        private fun validateExistingIndex(index: Int) {
            if (index < 0 || index >= items.size) {
                throw IndexOutOfBoundsException("List index $index is out of bounds.")
            }
        }

        private fun validateInsertionIndex(index: Int) {
            if (index < 0 || index > items.size) {
                throw IndexOutOfBoundsException("List index $index is out of bounds.")
            }
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
}
