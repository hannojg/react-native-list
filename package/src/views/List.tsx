import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, ViewStyle } from 'react-native'
import { callback, NitroModules } from 'react-native-nitro-modules'
import {
  createShareable,
  scheduleOnUI,
  UIRuntimeId,
} from 'react-native-worklets'
import type {
  ListDataSource,
  ListDataSourceMutation,
  ListItem,
  ListItemForType,
  ListItemType,
} from '../ListDataSource'
import {
  addListDataSourceMutationListener,
  getNativeListDataSource,
} from '../ListDataSource'
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

type RenderedElementRecord = {
  element: React.ReactElement
  itemId: number
  itemKey: string | null
  tag: number
}

type ListState = {
  elementRecords: RenderedElementRecord[]
  tagToArrayPosition: Record<number, number>
  tagToItemId: Record<number, number>
  tagToItemKey: Record<number, string>
  nextItemId: number
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

  const listState = useMemo(() => {
    return createShareable<ListState>(UIRuntimeId, {
      elementRecords: [],
      tagToArrayPosition: {},
      tagToItemId: {},
      tagToItemKey: {},
      nextItemId: 0,
    })
  }, [])

  const getListState = useCallback(() => {
    'worklet'
    if (listState.isHost === false) {
      throw new Error(
        'Expected listState to be only accessed on the UI Runtime!'
      )
    }
    return listState.value
  }, [listState])

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

  const clearListItemKeys = useMemo(() => {
    return () => {
      'worklet'

      const state = getListState()
      state.elementRecords.forEach((record) => {
        record.itemKey = null
      })

      for (const tagKey of Object.keys(state.tagToItemKey)) {
        delete state.tagToItemKey[Number(tagKey)]
      }
    }
  }, [getListState])

  const handleDataSourceMutation = useMemo(() => {
    return (mutation: ListDataSourceMutation) => {
      'worklet'

      if (mutation.type === 'replaceData') {
        clearListItemKeys()
        return
      }

      let itemKey: string
      if (mutation.type === 'removeItem') {
        itemKey = mutation.itemKey
      } else {
        itemKey = mutation.previousItemKey
      }

      const state = getListState()
      state.elementRecords.forEach((record) => {
        if (record.itemKey !== itemKey) {
          return
        }

        record.itemKey = null
        delete state.tagToItemKey[record.tag]
      })
    }
  }, [clearListItemKeys, getListState])

  useEffect(() => {
    return addListDataSourceMutationListener(
      dataSource,
      handleDataSourceMutation
    )
  }, [dataSource, handleDataSourceMutation])

  useEffect(() => {
    const ref = nativeListRef.current
    if (ref == null || !isNativeReady) return

    scheduleOnUI(clearListItemKeys)

    const nativeDataSource = getNativeListDataSource(dataSource)
    ref.setDataSource(nativeDataSource)
    ref.setLayout(resolvedLayout.__nativeLayout)
  }, [clearListItemKeys, dataSource, isNativeReady, resolvedLayout])

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
          const state = getListState()

          function renderListElements() {
            'worklet'

            return state.elementRecords.map((record) => {
              const wrapperStyle = {
                // Why are we rendering position absolute?
                // This will layout all items at (0x0).This is important because the native lists will relayout the views.
                // In one iteration I was rendering all items just regularly. When then the items position in the elements changed or items were added before,
                // fabric was thinking it had to update the layout position of those items, breaking the layout in the list.
                // If fabric thinks all items are always at (0x0) it won't get the idea to relocate them!
                position: 'absolute' as const,
                left: 0,
                top: 0,
              }
              const wrapperKey = 'mirror-item-' + record.itemId
              return (
                <View key={wrapperKey} style={wrapperStyle} collapsable={false}>
                  {record.element}
                </View>
              )
            })
          }

          function rebuildTagPositions() {
            'worklet'

            for (const key of Object.keys(state.tagToArrayPosition)) {
              delete state.tagToArrayPosition[Number(key)]
            }

            state.elementRecords.forEach((record, index) => {
              if (record.tag < 0) {
                return
              }

              state.tagToArrayPosition[record.tag] = index
            })
          }

          function renderContentInReact() {
            'worklet'

            const elements = renderListElements()
            const parentContainer = <View>{elements}</View>
            reactRender(parentContainer, () => {})
            rebuildTagPositions()
          }

          function setNativeListDataSource() {
            'worklet'

            const nativeDataSource = boxedDataSource.unbox()
            const nativeLayout = boxedLayout.unbox()
            ref.setDataSource(nativeDataSource)
            ref.setLayout(nativeLayout)
          }

          function createViewCallback(type: string) {
            const nativeRef = globalThis.React.createRef<NativeTaggedRef>()
            const itemId = state.nextItemId++
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
            const newLength = state.elementRecords.push(newRecord)
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
            state.tagToArrayPosition[tag] = currentIndex
            state.tagToItemId[tag] = itemId

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

            const itemId = state.tagToItemId[reactTag]
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

            const position = state.tagToArrayPosition[reactTag]
            if (position == null) {
              throw new Error('No position for tag ' + reactTag)
            }

            state.tagToItemKey[reactTag] = item.key

            const record = state.elementRecords[position]
            if (record == null) {
              throw new Error('No record for tag ' + reactTag)
            }

            record.element = newElementWithKey
            record.itemKey = item.key

            renderContentInReact()
            renderSyncWorklet()

            return true
          }

          const uiListModuleUnboxed = uiListModuleBoxed.unbox()
          ref.setListCallbacks(
            uiListModuleUnboxed,
            createViewCallback,
            updateViewCallback
          )
          setNativeListDataSource()
        })

        setIsNativeReady(true)
      })}
    />
  )
}

export const List = ListInner as <TItem extends ListItem>(
  props: ListProps<TItem>
) => React.ReactElement | null
