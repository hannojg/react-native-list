import { NitroModules } from 'react-native-nitro-modules'
import type { AnyMap } from 'react-native-nitro-modules'
import type {
  NativeListDataSource,
  NativeListItem,
} from './specs/NativeListDataSource.nitro'
import { useEffect, useRef } from 'react'

export type ListKey = string | number

export type ListItemSize = {
  width?: number
  height?: number
}

export type ListDataSourceConfig<T extends AnyMap, TType extends string> = {
  keyExtractor: (item: T, index: number) => ListKey
  getItemType: (item: T, index: number) => TType
  getItemSize?: (item: T, index: number) => ListItemSize
  isContentEqualByType: Record<TType, (oldItem: T, newItem: T) => boolean>
}

export type ListDataSource<T extends AnyMap> = {
  replaceData(data: readonly T[], animated?: boolean): void
  insertItem(index: number, item: T): void
  updateItem(index: number, item: T): void
  removeItem(index: number): void
  moveItem(fromIndex: number, toIndex: number): void
}

type NativeListDataSourceBacked<T extends AnyMap> = ListDataSource<T> & {
  __nativeDataSource: NativeListDataSource
  __setConfig(config: unknown): void
}

type NormalizationConfig<T extends AnyMap, TType extends string> = Omit<
  ListDataSourceConfig<T, TType>,
  'isContentEqualByType'
>

function assertValidSize(size: ListItemSize, index: number) {
  const width = size.width
  const height = size.height

  if (width != null && (!Number.isFinite(width) || width <= 0)) {
    throw new Error(`List item at index ${index} has an invalid width.`)
  }
  if (height != null && (!Number.isFinite(height) || height <= 0)) {
    throw new Error(`List item at index ${index} has an invalid height.`)
  }
}

function stringifyKey(key: ListKey, index: number): string {
  if (typeof key === 'string') {
    return key
  }
  if (typeof key === 'number') {
    return String(key)
  }
  throw new Error(`List item at index ${index} returned an invalid key.`)
}

function createNativeItem<T extends AnyMap, TType extends string>(
  item: T,
  index: number,
  config: NormalizationConfig<T, TType>
): NativeListItem {
  const rawKey = config.keyExtractor(item, index)
  const key = stringifyKey(rawKey, index)
  const type = config.getItemType(item, index)
  const size = config.getItemSize?.(item, index) ?? {}
  assertValidSize(size, index)

  return {
    key: key,
    type: type,
    width: size.width,
    height: size.height,
    data: item,
  }
}

function createNativeItems<T extends AnyMap, TType extends string>(
  data: readonly T[],
  config: NormalizationConfig<T, TType>
): NativeListItem[] {
  const seenIdentities = new Set<string>()
  const items: NativeListItem[] = []

  for (let index = 0; index < data.length; index++) {
    const item = data[index]
    if (item == null) {
      throw new Error(`List item at index ${index} is undefined.`)
    }

    const nativeItem = createNativeItem(item, index, config)
    const identity = nativeItem.type + ':' + nativeItem.key

    if (seenIdentities.has(identity)) {
      throw new Error(`List contains duplicate item identity "${identity}".`)
    }

    seenIdentities.add(identity)
    items.push(nativeItem)
  }

  return items
}

function setContentEqualCallback<T extends AnyMap, TType extends string>(
  nativeDataSource: NativeListDataSource,
  config: ListDataSourceConfig<T, TType>
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

    const type = newItem.type as TType
    const isContentEqual = config.isContentEqualByType[type]
    if (isContentEqual == null) {
      throw new Error('No content equality callback for list item type ' + type)
    }

    return isContentEqual(oldItem.data as T, newItem.data as T)
  })
}

export function createListDataSource<T extends AnyMap, TType extends string>(
  config: ListDataSourceConfig<T, TType>
): ListDataSource<T> {
  const nativeDataSource =
    NitroModules.createHybridObject<NativeListDataSource>(
      'NativeListDataSource'
    )
  let currentConfig = config

  setContentEqualCallback(nativeDataSource, currentConfig)

  const dataSource: NativeListDataSourceBacked<T> = {
    __nativeDataSource: nativeDataSource,
    __setConfig(nextConfig: unknown) {
      currentConfig = nextConfig as unknown as ListDataSourceConfig<T, TType>
      setContentEqualCallback(nativeDataSource, currentConfig)
    },
    replaceData(data: readonly T[], animated = true) {
      const items = createNativeItems(data, currentConfig)
      nativeDataSource.replaceData(items, animated)
    },
    insertItem(index: number, item: T) {
      const nativeItem = createNativeItem(item, index, currentConfig)
      nativeDataSource.insertItem(index, nativeItem)
    },
    updateItem(index: number, item: T) {
      const nativeItem = createNativeItem(item, index, currentConfig)
      nativeDataSource.updateItem(index, nativeItem)
    },
    removeItem(index: number) {
      nativeDataSource.removeItem(index)
    },
    moveItem(fromIndex: number, toIndex: number) {
      nativeDataSource.moveItem(fromIndex, toIndex)
    },
  }
  return dataSource
}

export function getNativeListDataSource<T extends AnyMap>(
  dataSource: ListDataSource<T>
): NativeListDataSource {
  const nativeBackedDataSource = dataSource as NativeListDataSourceBacked<T>
  return nativeBackedDataSource.__nativeDataSource
}

export function useListDataSource<T extends AnyMap, TType extends string>(
  config: ListDataSourceConfig<T, TType> & {
    data: readonly T[]
  }
): ListDataSource<T> {
  const dataSourceRef = useRef<ListDataSource<T> | null>(null)
  if (dataSourceRef.current == null) {
    dataSourceRef.current = createListDataSource(config)
  }

  const dataSource = dataSourceRef.current
  const nativeBackedDataSource = dataSource as NativeListDataSourceBacked<T>

  useEffect(() => {
    nativeBackedDataSource.__setConfig(config)
    dataSource.replaceData(config.data, true)
  }, [config, dataSource, nativeBackedDataSource])

  return dataSource
}
