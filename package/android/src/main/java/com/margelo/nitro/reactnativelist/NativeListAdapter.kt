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
