import { NitroModules } from 'react-native-nitro-modules'
import type { AnyMap } from 'react-native-nitro-modules'
import type { NativeListDataSource } from './specs/NativeListDataSource.nitro'
import { useEffect, useRef } from 'react'
import { scheduleOnUI } from 'react-native-worklets'

export type ListKey = string

export type ListItemSize = {
  width?: number
  height?: number
}

export type ListItem<
  Type = string,
  TData extends AnyMap = AnyMap,
> = ListItemSize & {
  key: ListKey
  type: Type
  data: TData
}

export type ListItemType<TItem extends ListItem> = TItem['type']

export type ListItemForType<
  TItem extends ListItem,
  TType extends ListItemType<TItem>,
> =
  Extract<TItem, { type: TType }> extends never
    ? TItem
    : Extract<TItem, { type: TType }>

export type ListContentEqualByType<TItem extends ListItem> = {
  [TType in ListItemType<TItem>]: (
    oldItem: ListItemForType<TItem, TType>,
    newItem: ListItemForType<TItem, TType>
  ) => boolean
}

export type ListDataSourceConfig<TItem extends ListItem> = {
  isContentEqualByType?: ListContentEqualByType<TItem>
}

export type ListDataSource<TItem extends ListItem> = {
  release(): void
  replaceData(data: readonly TItem[], animated?: boolean): void
  insertItem(index: number, item: TItem): void
  updateItem(index: number, item: TItem): void
  removeItem(index: number): void
  moveItem(fromIndex: number, toIndex: number): void
}

export type ListDataSourceMutation =
  | {
      type: 'replaceData'
    }
  | {
      type: 'removeItem'
      itemKey: string
    }
  | {
      type: 'updateItem'
      previousItemKey: string
    }

type ListDataSourceMutationListener = (mutation: ListDataSourceMutation) => void

type NativeListDataSourceBacked<TItem extends ListItem> =
  ListDataSource<TItem> & {
    __nativeDataSource: NativeListDataSource
    __setConfig(config: unknown): void
    __addMutationListener(listener: ListDataSourceMutationListener): () => void
  }

function setContentEqualCallback<TItem extends ListItem>(
  nativeDataSource: NativeListDataSource,
  config: ListDataSourceConfig<TItem>
) {
  nativeDataSource.setContentEqualCallback((oldItem, newItem) => {
    if (oldItem.type !== newItem.type) {
      return false
    }
    if (oldItem.width !== newItem.width) {
      return false
    }
    if (oldItem.height !== newItem.height) {
      return false
    }

    const type = newItem.type as TItem['type']
    const isContentEqual = config.isContentEqualByType?.[type]
    if (isContentEqual == null) {
      return false
    }

    return isContentEqual(
      oldItem as unknown as ListItemForType<TItem, typeof type>,
      newItem as unknown as ListItemForType<TItem, typeof type>
    )
  })
}

export function createListDataSource<TItem extends ListItem>(
  config: ListDataSourceConfig<TItem> = {}
): ListDataSource<TItem> {
  const nativeDataSource =
    NitroModules.createHybridObject<NativeListDataSource>(
      'NativeListDataSource'
    )
  let currentConfig = config
  let currentItems: TItem[] = []
  const mutationListeners = new Set<ListDataSourceMutationListener>()

  setContentEqualCallback(nativeDataSource, currentConfig)

  function notifyMutationListeners(mutation: ListDataSourceMutation) {
    mutationListeners.forEach((listener) => {
      scheduleOnUI(listener, mutation)
    })
  }

  const dataSource: NativeListDataSourceBacked<TItem> = {
    __nativeDataSource: nativeDataSource,
    __setConfig(nextConfig: unknown) {
      currentConfig = nextConfig as unknown as ListDataSourceConfig<TItem>
      setContentEqualCallback(nativeDataSource, currentConfig)
    },
    __addMutationListener(listener: ListDataSourceMutationListener) {
      mutationListeners.add(listener)
      return () => {
        mutationListeners.delete(listener)
      }
    },
    release() {
      currentConfig = {}
      currentItems = []
      mutationListeners.clear()
      nativeDataSource.dispose()
    },
    replaceData(data: readonly TItem[], animated: boolean = false) {
      const nextItems = [...data]
      currentItems = nextItems
      notifyMutationListeners({
        type: 'replaceData',
      })
      nativeDataSource.replaceData(nextItems, animated)
    },
    insertItem(index: number, item: TItem) {
      currentItems.splice(index, 0, item)
      nativeDataSource.insertItem(index, item)
    },
    updateItem(index: number, item: TItem) {
      const previousItem = currentItems[index]
      if (previousItem != null && previousItem.key !== item.key) {
        currentItems[index] = item
        notifyMutationListeners({
          type: 'updateItem',
          previousItemKey: previousItem.key,
        })
        nativeDataSource.updateItem(index, item)
        return
      }

      currentItems[index] = item
      nativeDataSource.updateItem(index, item)
    },
    removeItem(index: number) {
      const removedItems = currentItems.slice(index, index + 1)
      const removedItem = removedItems[0]
      currentItems.splice(index, 1)
      if (removedItem != null) {
        notifyMutationListeners({
          type: 'removeItem',
          itemKey: removedItem.key,
        })
      }
      nativeDataSource.removeItem(index)
    },
    moveItem(fromIndex: number, toIndex: number) {
      const removedItems = currentItems.slice(fromIndex, fromIndex + 1)
      const movedItem = removedItems[0]
      if (movedItem != null) {
        currentItems.splice(fromIndex, 1)
        currentItems.splice(toIndex, 0, movedItem)
      }
      nativeDataSource.moveItem(fromIndex, toIndex)
    },
  }
  return dataSource
}

export function getNativeListDataSource<TItem extends ListItem>(
  dataSource: ListDataSource<TItem>
): NativeListDataSource {
  const nativeBackedDataSource = dataSource as NativeListDataSourceBacked<TItem>
  return nativeBackedDataSource.__nativeDataSource
}

export function addListDataSourceMutationListener<TItem extends ListItem>(
  dataSource: ListDataSource<TItem>,
  listener: ListDataSourceMutationListener
) {
  const nativeBackedDataSource = dataSource as NativeListDataSourceBacked<TItem>
  return nativeBackedDataSource.__addMutationListener(listener)
}

export function useListDataSource<TItem extends ListItem>(
  config: ListDataSourceConfig<TItem> & {
    data: readonly TItem[]
  }
): ListDataSource<TItem> {
  const dataSourceRef = useRef<ListDataSource<TItem> | null>(null)
  if (dataSourceRef.current == null) {
    dataSourceRef.current = createListDataSource(config)
  }

  const dataSource = dataSourceRef.current
  const nativeBackedDataSource = dataSource as NativeListDataSourceBacked<TItem>

  useEffect(() => {
    nativeBackedDataSource.__setConfig(config)
    dataSource.replaceData(config.data, true)
  }, [config, dataSource, nativeBackedDataSource])

  useEffect(() => {
    return () => {
      dataSource.release()
    }
  }, [dataSource])

  return dataSource
}
