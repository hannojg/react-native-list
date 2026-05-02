import React, { useRef } from 'react'
import { UiListHostComponent } from './UiListHostComponent'
import { callback } from 'react-native-nitro-modules'
import { scheduleOnUI } from 'react-native-worklets'
import {
  renderSyncWorklet,
  uiListModuleBoxed,
} from '../renderer/fabric/RenderHelper'
import { View, ViewStyle } from 'react-native'
import { getReactFabricRenderer } from '../renderer/react/ReactFabricRenderer'

type NativeTaggedRef = {
  __nativeTag: number
}

export interface ListProps {
  renderItemWorklet: (itemInfo?: {
    index: number
    data?: any
  }) => React.ReactElement<any>
  style?: ViewStyle
}

export function List({ renderItemWorklet, style }: ListProps) {
  let isSetup = useRef(false)

  return (
    <UiListHostComponent
      style={style}
      hybridRef={callback((ref) => {
        if (isSetup.current) return
        isSetup.current = true

        scheduleOnUI(() => {
          'worklet'

          const { nativeLog, reactRender } = getReactFabricRenderer()

          nativeLog(
            'Setting makeNativeViewCallback on UiListView on',
            typeof ref.setMakeNativeViewCallback
          )

          const tagToArrayPosition: Record<number, number> = {}
          const tagToItemId: Record<number, number> = {}
          let nextItemId = 0
          const elementsRendered: React.ReactElement[] = []

          const uiListModuleUnboxed = uiListModuleBoxed.unbox()

          // TODO: can we enable this somehow as a prop?
          ref.setMakeNativeViewCallback(uiListModuleUnboxed, () => {
            const nativeRef = globalThis.React.createRef<NativeTaggedRef>()
            const itemId = nextItemId++
            const newElement = renderItemWorklet(undefined)
            const newProps = {
              // by creating the views with a key, we can later just update this view specifically
              key: 'itemid-' + itemId,
              // ref needed to get native react tag after rendering later
              ref: nativeRef,
              // important so the native layer can find this view
              collapsable: false,
            }
            const newElementWithKey = globalThis.React.cloneElement(
              newElement,
              newProps
            )

            const newLength = elementsRendered.push(newElementWithKey)
            const currentIndex = newLength - 1

            // We have to render n-items in a single view:
            const ParentContainer = <View>{elementsRendered}</View>

            // global.log("Render result:");
            // global.log(ParentContainer.props.children);

            reactRender(ParentContainer, () => {
              nativeLog('Render complete')
            })

            if (nativeRef.current == null) {
              throw new Error('Ref is null after render')
            }

            // const shadowNode = ref.current.node; // jsi::Object NativeState ShadowNodeWrapper
            const currentKeys = Object.keys(nativeRef.current)
            nativeLog('Ref current:', currentKeys)
            const tag = nativeRef.current.__nativeTag
            nativeLog('Ref current nativeTag: ', tag)
            tagToArrayPosition[tag] = currentIndex
            tagToItemId[tag] = itemId

            // cause a sync render to create the actual native view
            const start = globalThis.performance.now()
            renderSyncWorklet()
            const end = globalThis.performance.now()
            nativeLog('renderSync took ', end - start, 'ms')

            return tag
          })

          ref.setUpdateViewCallback(
            uiListModuleUnboxed,
            (reactTag: number, index: number) => {
              nativeLog(
                `[JS] Update view callback called for tag ${reactTag} at index ${index}`,
                tagToArrayPosition
              )

              const itemId = tagToItemId[reactTag]
              if (itemId == null) {
                throw new Error('No itemId for tag ' + reactTag)
              }

              // "Rerender the element"
              const newElement = renderItemWorklet({
                index,
                data: null, // TODO
              })
              const newProps = {
                key: 'itemid-' + itemId,
                collapsable: false, // important so the native layer can find this view
              }
              const newElementWithKey = globalThis.React.cloneElement(
                newElement,
                newProps
              )

              // Update the new element in the global array
              const position = tagToArrayPosition[reactTag]
              if (position == null) {
                throw new Error('No position for tag ' + reactTag)
              }
              elementsRendered[position] = newElementWithKey

              // TODO: can we unify this following part?

              // Update the parent container
              const ParentContainer = <View>{elementsRendered}</View>

              reactRender(ParentContainer, () => {
                nativeLog('Update Render complete')
              })

              // Cause a sync render to update the actual native view
              const start = globalThis.performance.now()
              renderSyncWorklet()
              const end = globalThis.performance.now()
              nativeLog('Update renderSync took ', end - start, 'ms')

              return true
            }
          )
        })
      })}
    />
  )
}
