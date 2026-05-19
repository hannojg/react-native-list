package com.margelo.nitro.reactnativelist

import android.graphics.Color
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType

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
}
