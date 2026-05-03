import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, ViewStyle } from 'react-native'
import { callback, NitroModules } from 'react-native-nitro-modules'
import type { AnyMap } from 'react-native-nitro-modules'
import { scheduleOnUI } from 'react-native-worklets'
import type { ListDataSource } from '../ListDataSource'
import { getNativeListDataSource } from '../ListDataSource'
import { createLinearListLayout, ListLayout } from '../ListLayout'
import {
  renderSyncWorklet,
  uiListModuleBoxed,
} from '../renderer/fabric/RenderHelper'
import { getReactFabricRenderer } from '../renderer/react/ReactFabricRenderer'
import type { NativeListItem } from '../specs/NativeListDataSource.nitro'
import type { UiListViewMethods } from '../specs/UiListView.nitro'
import { UiListHostComponent } from './UiListHostComponent'

type NativeTaggedRef = {
  __nativeTag: number
}

export type ListRenderer<T extends AnyMap, TType extends string> = {
  renderItemWorklet: (info: {
    item?: T
    index?: number
    key?: string
    type: TType
  }) => React.ReactElement<any>
}

export type ListProps<T extends AnyMap, TType extends string> = {
  dataSource: ListDataSource<T>
  layout?: ListLayout
  renderers: Record<TType, ListRenderer<T, TType>>
  style?: ViewStyle
}

function ListInner<T extends AnyMap, TType extends string>(
  props: ListProps<T, TType>
) {
  const { dataSource, layout, renderers, style } = props
  const isSetup = useRef(false)
  const nativeListRef = useRef<UiListViewMethods | null>(null)
  const [isNativeReady, setIsNativeReady] = useState(false)

  const resolvedLayout = useMemo(() => {
    return layout ?? createLinearListLayout()
  }, [layout])

  const boxedDataSource = useMemo(() => {
    const nativeDataSource = getNativeListDataSource(dataSource)
    return NitroModules.box(nativeDataSource)
  }, [dataSource])

  const boxedLayout = useMemo(() => {
    return NitroModules.box(resolvedLayout.__nativeLayout)
  }, [resolvedLayout])

  useEffect(() => {
    const ref = nativeListRef.current
    if (ref == null || !isNativeReady) return

    const nativeDataSource = getNativeListDataSource(dataSource)
    ref.setDataSource(nativeDataSource)
    ref.setLayout(resolvedLayout.__nativeLayout)
  }, [dataSource, isNativeReady, resolvedLayout])

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
            }
          )

          const nativeDataSource = boxedDataSource.unbox()
          const nativeLayout = boxedLayout.unbox()
          ref.setDataSource(nativeDataSource)
          ref.setLayout(nativeLayout)
        })

        setIsNativeReady(true)
      })}
    />
  )
}

export const List = ListInner as <T extends AnyMap, TType extends string>(
  props: ListProps<T, TType>
) => React.ReactElement | null
