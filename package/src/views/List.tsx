import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { UiListHostComponent } from './UiListHostComponent'
import { callback } from 'react-native-nitro-modules'
import type { AnyMap } from 'react-native-nitro-modules'
import { scheduleOnUI } from 'react-native-worklets'
import {
  renderSyncWorklet,
  uiListModuleBoxed,
} from '../renderer/fabric/RenderHelper'
import { View, ViewStyle } from 'react-native'
import { getReactFabricRenderer } from '../renderer/react/ReactFabricRenderer'
import type {
  NativeListItem,
  UiListViewMethods,
} from '../specs/UiListView.nitro'

type NativeTaggedRef = {
  __nativeTag: number
}

export type ListKey = string | number

export type ListItemSize = {
  width: number
  height: number
}

export type ListRenderer<T extends AnyMap, TType extends string> = {
  renderItemWorklet: (info: {
    item?: T
    index?: number
    key?: string
    type: TType
  }) => React.ReactElement<any>
  isContentEqualWorklet: (oldItem: T, newItem: T) => boolean
}

export type ListProps<T extends AnyMap, TType extends string> = {
  data: readonly T[]
  keyExtractor: (item: T, index: number) => ListKey
  getItemType: (item: T, index: number) => TType
  getItemSize: (item: T, index: number) => ListItemSize
  renderers: Record<TType, ListRenderer<T, TType>>
  style?: ViewStyle
}

type ListDataProps<T extends AnyMap, TType extends string> = Omit<
  ListProps<T, TType>,
  'style'
>

export type ListRef<T extends AnyMap> = {
  replaceData(data: readonly T[], animated?: boolean): void
  insertItem(index: number, item: T): void
  updateItem(index: number, item: T): void
  removeItem(index: number): void
  moveItem(fromIndex: number, toIndex: number): void
}

function assertValidSize(size: ListItemSize, index: number) {
  const width = size.width
  const height = size.height
  const isWidthFinite = Number.isFinite(width)
  const isHeightFinite = Number.isFinite(height)

  if (!isWidthFinite || width <= 0) {
    throw new Error(`List item at index ${index} has an invalid width.`)
  }
  if (!isHeightFinite || height <= 0) {
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
  props: ListDataProps<T, TType>
): NativeListItem {
  const rawKey = props.keyExtractor(item, index)
  const key = stringifyKey(rawKey, index)
  const type = props.getItemType(item, index)
  const renderer = props.renderers[type]

  if (renderer == null) {
    throw new Error(`List item at index ${index} uses unknown type "${type}".`)
  }

  const size = props.getItemSize(item, index)
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
  props: ListDataProps<T, TType>
): NativeListItem[] {
  const seenIdentities = new Set<string>()
  const items: NativeListItem[] = []

  for (let index = 0; index < data.length; index++) {
    const item = data[index]
    if (item == null) {
      throw new Error(`List item at index ${index} is undefined.`)
    }

    const nativeItem = createNativeItem(item, index, props)
    const identity = nativeItem.type + ':' + nativeItem.key

    if (seenIdentities.has(identity)) {
      throw new Error(`List contains duplicate item identity "${identity}".`)
    }

    seenIdentities.add(identity)
    items.push(nativeItem)
  }

  return items
}

function ListInner<T extends AnyMap, TType extends string>(
  props: ListProps<T, TType>,
  forwardedRef: React.ForwardedRef<ListRef<T>>
) {
  const { data, getItemSize, getItemType, keyExtractor, renderers, style } =
    props
  const isSetup = useRef(false)
  const nativeListRef = useRef<UiListViewMethods | null>(null)
  const [isNativeReady, setIsNativeReady] = useState(false)

  const nativeItems = useMemo(() => {
    const normalizationProps = {
      data,
      keyExtractor,
      getItemType,
      getItemSize,
      renderers,
    }
    return createNativeItems(data, normalizationProps)
  }, [data, getItemSize, getItemType, keyExtractor, renderers])

  useImperativeHandle(forwardedRef, () => {
    return {
      replaceData(nextData: readonly T[], animated = true) {
        const ref = nativeListRef.current
        if (ref == null) return

        const nextItems = createNativeItems(nextData, props)
        ref.setData(nextItems, animated)
      },
      insertItem(index: number, item: T) {
        const ref = nativeListRef.current
        if (ref == null) return

        const nativeItem = createNativeItem(item, index, props)
        ref.insertItem(index, nativeItem)
      },
      updateItem(index: number, item: T) {
        const ref = nativeListRef.current
        if (ref == null) return

        const nativeItem = createNativeItem(item, index, props)
        ref.updateItem(index, nativeItem)
      },
      removeItem(index: number) {
        const ref = nativeListRef.current
        if (ref == null) return

        ref.removeItem(index)
      },
      moveItem(fromIndex: number, toIndex: number) {
        const ref = nativeListRef.current
        if (ref == null) return

        ref.moveItem(fromIndex, toIndex)
      },
    }
  }, [props])

  useEffect(() => {
    const ref = nativeListRef.current
    if (ref == null || !isNativeReady) return

    ref.setData(nativeItems, true)
  }, [isNativeReady, nativeItems])

  return (
    <UiListHostComponent
      style={style}
      hybridRef={callback((ref) => {
        nativeListRef.current = ref

        if (isSetup.current) return
        isSetup.current = true

        scheduleOnUI(() => {
          'worklet'

          const { nativeLog, reactRender } = getReactFabricRenderer()
          const tagToArrayPosition: Record<number, number> = {}
          const tagToItemId: Record<number, number> = {}
          let nextItemId = 0
          const elementsRendered: React.ReactElement[] = []

          const uiListModuleUnboxed = uiListModuleBoxed.unbox()

          ref.setListCallbacks(
            uiListModuleUnboxed,
            (type: string) => {
              const nativeRef = globalThis.React.createRef<NativeTaggedRef>()
              const itemId = nextItemId++
              const typedType = type as TType
              const renderer = renderers[typedType]

              if (renderer == null) {
                throw new Error('No renderer for list item type ' + type)
              }

              const newElement = renderer.renderItemWorklet({
                type: typedType,
              })

              const newProps = {
                key: 'itemid-' + itemId,
                ref: nativeRef,
                collapsable: false,
              }
              const newElementWithKey = globalThis.React.cloneElement(
                newElement,
                newProps
              )

              const newLength = elementsRendered.push(newElementWithKey)
              const currentIndex = newLength - 1
              const parentContainer = <View>{elementsRendered}</View>

              reactRender(parentContainer, () => {
                nativeLog('Render complete')
              })

              if (nativeRef.current == null) {
                throw new Error('Ref is null after render')
              }

              const tag = nativeRef.current.__nativeTag
              tagToArrayPosition[tag] = currentIndex
              tagToItemId[tag] = itemId

              const start = globalThis.performance.now()
              renderSyncWorklet()
              const end = globalThis.performance.now()
              nativeLog('renderSync took ', end - start, 'ms')

              return tag
            },
            (reactTag: number, item: NativeListItem, index: number) => {
              const typedType = item.type as TType
              const renderer = renderers[typedType]

              if (renderer == null) {
                throw new Error('No renderer for list item type ' + item.type)
              }

              const itemId = tagToItemId[reactTag]
              if (itemId == null) {
                throw new Error('No itemId for tag ' + reactTag)
              }

              const newElement = renderer.renderItemWorklet({
                item: item.data as T,
                index,
                key: item.key,
                type: typedType,
              })
              const newProps = {
                key: 'itemid-' + itemId,
                collapsable: false,
              }
              const newElementWithKey = globalThis.React.cloneElement(
                newElement,
                newProps
              )

              const position = tagToArrayPosition[reactTag]
              if (position == null) {
                throw new Error('No position for tag ' + reactTag)
              }

              elementsRendered[position] = newElementWithKey

              const parentContainer = <View>{elementsRendered}</View>

              reactRender(parentContainer, () => {
                nativeLog('Update Render complete')
              })

              const start = globalThis.performance.now()
              renderSyncWorklet()
              const end = globalThis.performance.now()
              nativeLog('Update renderSync took ', end - start, 'ms')

              return true
            },
            (oldItem: NativeListItem, newItem: NativeListItem) => {
              if (oldItem.type !== newItem.type) {
                return false
              }
              if (oldItem.width !== newItem.width) {
                return false
              }
              if (oldItem.height !== newItem.height) {
                return false
              }

              const typedType = newItem.type as TType
              const renderer = renderers[typedType]

              if (renderer == null) {
                throw new Error(
                  'No renderer for list item type ' + newItem.type
                )
              }

              return renderer.isContentEqualWorklet(
                oldItem.data as T,
                newItem.data as T
              )
            }
          )

          ref.setData(nativeItems, false)
        })

        setIsNativeReady(true)
      })}
    />
  )
}

export const List = forwardRef(ListInner) as <
  T extends AnyMap,
  TType extends string,
>(
  props: ListProps<T, TType> & {
    ref?: React.ForwardedRef<ListRef<T>>
  }
) => React.ReactElement | null
