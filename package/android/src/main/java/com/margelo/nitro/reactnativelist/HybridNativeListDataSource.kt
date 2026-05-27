package com.margelo.nitro.reactnativelist

import androidx.recyclerview.widget.DiffUtil

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

    override fun dispose() {
        observer = null
        items = emptyList()
        isContentEqual = { _, _ -> false }
    }

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
