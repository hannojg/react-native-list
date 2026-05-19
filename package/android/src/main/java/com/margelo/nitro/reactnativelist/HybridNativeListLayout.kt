package com.margelo.nitro.reactnativelist

import android.graphics.Rect
import android.view.View
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.ThemedReactContext
import kotlin.math.roundToInt

open class HybridNativeListLayout : HybridNativeListLayoutSpec()

internal interface NativeListLayoutProvider {
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
        outRect: Rect,
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
