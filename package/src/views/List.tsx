import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, ViewStyle } from 'react-native'
import { callback, NitroModules } from 'react-native-nitro-modules'
import { scheduleOnUI } from 'react-native-worklets'
import type {
  ListDataSource,
  ListItem,
  ListItemForType,
  ListItemType,
} from '../ListDataSource'
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

export type ListRenderer<TItem extends ListItem> = {
  renderItemWorklet: (info: {
    item?: TItem
    index?: number
    key?: string
    type: ListItemType<TItem>
  }) => React.ReactElement<any>
}

export type ListRenderers<TItem extends ListItem> = {
  [TType in ListItemType<TItem>]: ListRenderer<ListItemForType<TItem, TType>>
}

export type ListProps<TItem extends ListItem> = {
  dataSource: ListDataSource<TItem>
  layout?: ListLayout
  renderers: ListRenderers<TItem>
  style?: ViewStyle
}

function ListInner<TItem extends ListItem>(props: ListProps<TItem>) {
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

          const { reactRender } = getReactFabricRenderer()
          type RenderedElementRecord = {
            element: React.ReactElement
            itemId: number
            itemKey: string | null
            tag: number
          }

          const tagToArrayPosition: Record<number, number> = {}
          const tagToItemId: Record<number, number> = {}
          const tagToItemKey: Record<number, string> = {}
          let nextItemId = 0
          const elementRecords: RenderedElementRecord[] = []

          function renderListElements() {
            'worklet'

            return elementRecords.map((record) => {
              const wrapperStyle = {
                position: 'absolute' as const,
                left: 0,
                top: 0,
              }
              const wrapperProps = {
                key: 'mirror-item-' + record.itemId,
                style: wrapperStyle,
                collapsable: false,
              }
              return <View {...wrapperProps}>{record.element}</View>
            })
          }

          function rebuildTagPositions() {
            'worklet'

            for (const key of Object.keys(tagToArrayPosition)) {
              delete tagToArrayPosition[Number(key)]
            }

            elementRecords.forEach((record, index) => {
              if (record.tag < 0) {
                return
              }

              tagToArrayPosition[record.tag] = index
            })
          }

          function renderContentInReact() {
            'worklet'

            const elements = renderListElements()
            const parentContainer = <View>{elements}</View>
            reactRender(parentContainer, () => {})
            rebuildTagPositions()
          }

          function syncActiveItemKeys(activeKeys: string[]) {
            'worklet'

            const activeKeySet: Record<string, boolean> = {}
            activeKeys.forEach((activeKey) => {
              activeKeySet[activeKey] = true
            })

            elementRecords.forEach((record) => {
              if (record.itemKey == null) {
                return
              }
              if (activeKeySet[record.itemKey] === true) {
                return
              }

              record.itemKey = null
              delete tagToItemKey[record.tag]
            })
            return true
          }

          const uiListModuleUnboxed = uiListModuleBoxed.unbox()

          function createViewCallback(type: string) {
            const nativeRef = globalThis.React.createRef<NativeTaggedRef>()
            const itemId = nextItemId++
            const typedType = type as ListItemType<TItem>
            const renderer = renderers[typedType] as ListRenderer<TItem>

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

            const newRecord: RenderedElementRecord = {
              element: newElementWithKey,
              itemId,
              itemKey: null,
              tag: -1,
            }
            const newLength = elementRecords.push(newRecord)
            const currentIndex = newLength - 1

            // Why for rendering one item we have to render the whole content?!
            // Thats because react/react-native would issue remove transitions if we'd only render the item we need, and then swap it for another item.
            // When rendering all content react-reconciler will only update the diff on the native side, which is just this one item, so performance wise this seems to be okay.
            renderContentInReact()

            if (nativeRef.current == null) {
              throw new Error('Ref is null after render')
            }

            const tag = nativeRef.current.__nativeTag
            newRecord.tag = tag
            tagToArrayPosition[tag] = currentIndex
            tagToItemId[tag] = itemId

            renderSyncWorklet()

            return tag
          }

          function updateViewCallback(
            reactTag: number,
            item: NativeListItem,
            index: number
          ) {
            const typedType: ListItemType<TItem> = item.type
            const renderer = renderers[typedType] as ListRenderer<TItem>

            if (renderer == null) {
              throw new Error('No renderer for list item type ' + item.type)
            }

            const itemId = tagToItemId[reactTag]
            if (itemId == null) {
              throw new Error('No itemId for tag ' + reactTag)
            }

            const newElement = renderer.renderItemWorklet({
              item: item as unknown as TItem,
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

            tagToItemKey[reactTag] = item.key

            const record = elementRecords[position]
            if (record == null) {
              throw new Error('No record for tag ' + reactTag)
            }

            record.element = newElementWithKey
            record.itemKey = item.key

            renderContentInReact()
            renderSyncWorklet()

            return true
          }

          ref.setListCallbacks(
            uiListModuleUnboxed,
            createViewCallback,
            updateViewCallback,
            syncActiveItemKeys
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

export const List = ListInner as <TItem extends ListItem>(
  props: ListProps<TItem>
) => React.ReactElement | null
