package com.margelo.nitro.reactnativelist

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.ThemedReactContext
import kotlin.math.roundToInt

internal class NativeListAdapter(
    private val reactContext: ThemedReactContext,
    private val createView: (type: String) -> View,
    private val updateView: (reactTag: Double, item: NativeListItem, index: Double) -> Boolean
) : RecyclerView.Adapter<NativeListAdapter.ViewHolder>() {

    var dataSource: HybridNativeListDataSource? = null
    private val viewTypeByItemType = mutableMapOf<String, Int>()
    private val itemTypeByViewType = mutableMapOf<Int, String>()
    private val measuredContentSizeByItemKey = mutableMapOf<String, PixelSize>()
    private var nextViewType = 1

    class ViewHolder(val container: FrameLayout) : RecyclerView.ViewHolder(container) {
        var hostedView: View? = null
        var itemType: String? = null
        var reactTag: Int? = null
    }

    private data class PixelSize(
        val width: Int?,
        val height: Int?
    )

    private data class ResolvedPixelSize(
        val width: Int,
        val height: Int
    )

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
        val itemType = itemTypeByViewType[viewType]
            ?: throw IllegalStateException("Missing item type for viewType $viewType.")
        val child = createView(itemType)
        val existingParent = child.parent as? ViewGroup
        existingParent?.removeView(child)

        container.addView(child)
        val holder = ViewHolder(container)
        holder.hostedView = child
        holder.itemType = itemType
        holder.reactTag = child.id
        return holder
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = requireDataSource().getItemAt(position)
        val child = requireHostedView(holder, item)
        prepareChildLayoutForMeasurement(child, item)
        val reactTag = holder.reactTag
        if (reactTag != null) {
            val reactTagDouble = reactTag.toDouble()
            val positionDouble = position.toDouble()
            updateView(reactTagDouble, item, positionDouble)
        }

        captureMeasuredContentSize(item.key, child)
        val contentSize = resolvedContentSize(item)
        bindContainerLayout(holder.container, contentSize)
        bindChildLayout(child, contentSize)
    }

    override fun getItemCount(): Int {
        return dataSource?.getCountAsInt() ?: 0
    }

    fun retainMeasuredContent(dataSource: HybridNativeListDataSource) {
        val activeKeys = mutableSetOf<String>()
        val itemCount = dataSource.getCountAsInt()
        for (index in 0 until itemCount) {
            val item = dataSource.getItemAt(index)
            activeKeys.add(item.key)
        }

        val measuredSizeIterator = measuredContentSizeByItemKey.keys.iterator()
        while (measuredSizeIterator.hasNext()) {
            val itemKey = measuredSizeIterator.next()
            if (activeKeys.contains(itemKey)) {
                continue
            }
            measuredSizeIterator.remove()
        }
    }

    private fun requireDataSource(): HybridNativeListDataSource {
        return dataSource ?: throw IllegalStateException("NativeListDataSource is not set.")
    }

    private fun requireHostedView(holder: ViewHolder, item: NativeListItem): View {
        if (holder.itemType != item.type) {
            throw IllegalStateException(
                "RecyclerView supplied holder for type '${holder.itemType}' " +
                    "to item type '${item.type}'."
            )
        }
        return holder.hostedView ?: throw IllegalStateException("ViewHolder has no hosted view.")
    }

    private fun captureMeasuredContentSize(itemKey: String, view: View) {
        val existingSize = measuredContentSizeByItemKey[itemKey]
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

        measuredContentSizeByItemKey[itemKey] = PixelSize(
            width = nextWidth,
            height = nextHeight
        )
    }

    private fun resolvedContentSize(item: NativeListItem): ResolvedPixelSize {
        val measuredSize = measuredContentSizeByItemKey[item.key]
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

    private fun prepareChildLayoutForMeasurement(child: View, item: NativeListItem) {
        if (item.width != null && item.height != null) {
            return
        }

        val width = item.width?.let { toPixels(it) } ?: ViewGroup.LayoutParams.WRAP_CONTENT
        val height = item.height?.let { toPixels(it) } ?: ViewGroup.LayoutParams.WRAP_CONTENT
        val layoutParams = FrameLayout.LayoutParams(width, height)
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
