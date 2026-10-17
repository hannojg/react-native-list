import React, { useCallback, useEffect, useMemo, useRef } from 'react'
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
import { useChangeEffect } from '../hooks/useChangeEffect'
import {
  completeRootSyncWorklet,
  registerManagedSurfaceWorklet,
  unregisterManagedSurfaceWorklet,
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
  surfaceId: number
  /**
   * Stable React element key for a rendered slot in our tree.
   */
  reactKey: number
  /**
   * Datasource item identity.
   * The user provided key for an item with data.
   */
  dataKey: string | null
  /**
   * Native React tag binding this React instance to a React Native view.
   * A React tag can exist without a dataKey while the view is not currently
   * bound to a datasource item.
   */
  reactTag: number
}

type ListState = {
  recordsBySurfaceId: Record<number, RenderedElementRecord>
  recordsByReactTag: Record<number, RenderedElementRecord>
  reactTagToReactKey: Record<number, number>
  reactTagToDataKey: Record<number, string>
  dataKeyToReactTag: Record<string, number>
  nextReactKey: number
  isDisposed: boolean
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

  const listState = useMemo(() => {
    return createShareable<ListState>(UIRuntimeId, {
      recordsBySurfaceId: {},
      nextReactKey: 0,
      recordsByReactTag: {},
      reactTagToReactKey: {},
      // Maintain two reverse lookups that are one-to-one
      // Used for O(1) operations in element updates and removals,
      // where we only get the reactTag from native, and need to find the record,
      // or need to find the reactTag for a dataKey
      reactTagToDataKey: {},
      dataKeyToReactTag: {},
      isDisposed: false,
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
    if (layout != null) {
      return layout
    }

    return createLinearListLayout()
  }, [layout])

  const ownsResolvedLayout = layout == null

  useEffect(() => {
    if (!ownsResolvedLayout) {
      return
    }

    return () => {
      resolvedLayout.release()
    }
  }, [ownsResolvedLayout, resolvedLayout])

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
      const records = Object.values(state.recordsBySurfaceId)
      records.forEach((record) => {
        record.dataKey = null
      })

      for (const tagKey of Object.keys(state.reactTagToDataKey)) {
        delete state.reactTagToDataKey[Number(tagKey)]
      }

      for (const dataKey of Object.keys(state.dataKeyToReactTag)) {
        delete state.dataKeyToReactTag[dataKey]
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

      let dataKey: string
      if (mutation.type === 'removeItem') {
        dataKey = mutation.itemKey
      } else {
        dataKey = mutation.previousItemKey
      }

      const state = getListState()
      const reactTag = state.dataKeyToReactTag[dataKey]
      if (reactTag == null) {
        return
      }

      const record = state.recordsByReactTag[reactTag]
      if (record == null) {
        delete state.dataKeyToReactTag[dataKey]
        delete state.reactTagToDataKey[reactTag]
        return
      }

      if (record.dataKey !== dataKey) {
        delete state.dataKeyToReactTag[dataKey]
        return
      }

      record.dataKey = null
      delete state.dataKeyToReactTag[dataKey]
      delete state.reactTagToDataKey[reactTag]
    }
  }, [clearListItemKeys, getListState])

  useEffect(() => {
    return addListDataSourceMutationListener(
      dataSource,
      handleDataSourceMutation
    )
  }, [dataSource, handleDataSourceMutation])

  useEffect(() => {
    return () => {
      const ref = nativeListRef.current

      nativeListRef.current = null
      isSetup.current = false

      if (ref == null) {
        return
      }

      scheduleOnUI(() => {
        'worklet'

        const state = getListState()
        state.isDisposed = true

        ref.disposeRendererSurface()

        for (const key of Object.keys(state.reactTagToReactKey)) {
          delete state.reactTagToReactKey[Number(key)]
        }

        for (const key of Object.keys(state.reactTagToDataKey)) {
          delete state.reactTagToDataKey[Number(key)]
        }

        for (const key of Object.keys(state.dataKeyToReactTag)) {
          delete state.dataKeyToReactTag[key]
        }
      })
    }
  }, [getListState])

  useChangeEffect(() => {
    const ref = nativeListRef.current
    if (ref == null) return

    scheduleOnUI(clearListItemKeys)

    const nativeDataSource = getNativeListDataSource(dataSource)
    ref.setDataSource(nativeDataSource)
    ref.setLayout(resolvedLayout.__nativeLayout)
  }, [clearListItemKeys, dataSource, resolvedLayout])

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
          state.isDisposed = false

          function disposeViewCallback(surfaceId: number) {
            const record = state.recordsBySurfaceId[surfaceId]
            if (record == null) return false
            delete state.recordsBySurfaceId[surfaceId]
            delete state.recordsByReactTag[record.reactTag]
            delete state.reactTagToReactKey[record.reactTag]
            delete state.reactTagToDataKey[record.reactTag]
            if (
              record.dataKey != null &&
              state.dataKeyToReactTag[record.dataKey] === record.reactTag
            ) {
              delete state.dataKeyToReactTag[record.dataKey]
            }
            const { disposeReactRoot } = getReactFabricRenderer()
            try {
              // @ts-expect-error TODO: type renderer child sets
              disposeReactRoot(surfaceId, completeRootSyncWorklet)
            } finally {
              unregisterManagedSurfaceWorklet(surfaceId)
            }
            return true
          }

          function bindDataKeyToReactTag(dataKey: string, reactTag: number) {
            'worklet'

            const previousDataKey = state.reactTagToDataKey[reactTag]
            if (previousDataKey != null && previousDataKey !== dataKey) {
              // This same reactTag used to represent another dataKey.
              // If it is now being assigned to dataKey, remove the old reverse lookup
              delete state.dataKeyToReactTag[previousDataKey]
            }

            const previousReactTag = state.dataKeyToReactTag[dataKey]
            if (previousReactTag != null && previousReactTag !== reactTag) {
              // This dataKey used to point at another reactTag.
              // If it is now being assigned to this reactTag, clear the old tag's binding
              const previousRecord = state.recordsByReactTag[previousReactTag]
              if (previousRecord != null) {
                previousRecord.dataKey = null
              }
              delete state.reactTagToDataKey[previousReactTag]
            }

            state.reactTagToDataKey[reactTag] = dataKey
            state.dataKeyToReactTag[dataKey] = reactTag
          }

          function renderContentInReact(record: RenderedElementRecord) {
            'worklet'

            if (state.isDisposed) {
              return
            }

            const parentContainer = (
              <View collapsable={false}>{record.element}</View>
            )
            reactRender(
              record.surfaceId,
              parentContainer,
              () => {},
              // @ts-expect-error TODO: fix this one day
              completeRootSyncWorklet
            )
          }

          function setNativeListDataSource() {
            'worklet'

            const nativeDataSource = boxedDataSource.unbox()
            const nativeLayout = boxedLayout.unbox()
            ref.setDataSource(nativeDataSource)
            ref.setLayout(nativeLayout)
          }

          function createViewCallback(type: string, surfaceId: number) {
            if (state.isDisposed) {
              throw new Error('Cannot create view after list was disposed')
            }

            const nativeRef = globalThis.React.createRef<NativeTaggedRef>()
            const reactKey = state.nextReactKey++
            const typedType = type as ListItemType<TItem>
            const renderer = renderers[typedType] as ListRenderer<TItem>

            if (renderer == null) {
              throw new Error('No renderer for list item type ' + type)
            }

            const newElement = renderer.renderItemWorklet({
              type: typedType,
            })

            const newProps = {
              key: 'reactkey-' + reactKey,
              ref: nativeRef,
              collapsable: false,
            }
            const newElementWithKey = globalThis.React.cloneElement(
              newElement,
              newProps
            )

            const newRecord: RenderedElementRecord = {
              element: newElementWithKey,
              surfaceId,
              reactKey,
              dataKey: null,
              reactTag: -1,
            }
            state.recordsBySurfaceId[surfaceId] = newRecord
            registerManagedSurfaceWorklet(surfaceId)
            renderContentInReact(newRecord)

            if (nativeRef.current == null) {
              throw new Error('Ref is null after render')
            }

            const reactTag = nativeRef.current.__nativeTag
            newRecord.reactTag = reactTag
            state.recordsByReactTag[reactTag] = newRecord
            state.reactTagToReactKey[reactTag] = reactKey

            return reactTag
          }

          function updateViewCallback(
            reactTag: number,
            item: NativeListItem,
            index: number
          ) {
            if (state.isDisposed) {
              return false
            }

            const typedType: ListItemType<TItem> = item.type
            const renderer = renderers[typedType] as ListRenderer<TItem>

            if (renderer == null) {
              throw new Error('No renderer for list item type ' + item.type)
            }

            const reactKey = state.reactTagToReactKey[reactTag]
            if (reactKey == null) {
              throw new Error('No reactKey for reactTag ' + reactTag)
            }

            const newElement = renderer.renderItemWorklet({
              item: item as unknown as TItem,
              index,
              key: item.key,
              type: typedType,
            })
            const newProps = {
              key: 'reactkey-' + reactKey,
              collapsable: false,
            }
            const newElementWithKey = globalThis.React.cloneElement(
              newElement,
              newProps
            )

            const record = state.recordsByReactTag[reactTag]
            if (record == null) {
              throw new Error('No record for reactTag ' + reactTag)
            }

            bindDataKeyToReactTag(item.key, reactTag)
            record.element = newElementWithKey
            record.dataKey = item.key

            renderContentInReact(record)

            return true
          }

          const uiListModuleUnboxed = uiListModuleBoxed.unbox()
          ref.setListCallbacks(
            uiListModuleUnboxed,
            createViewCallback,
            updateViewCallback,
            disposeViewCallback
          )
          setNativeListDataSource()
        })
      })}
    />
  )
}

export const List = ListInner as <TItem extends ListItem>(
  props: ListProps<TItem>
) => React.ReactElement | null
