import React from 'react'
import { UiListHostComponent } from './UiListHostComponent'
import { callback, NitroModules } from 'react-native-nitro-modules'
import { View, ViewProps } from 'react-native'
import { scheduleOnUI } from 'react-native-worklets'
import { uiListModule } from './UiListModule'
import { uiManagerHelper } from './UiManagerHelper'

let isSetup = false

// TODO: in bundle mode i can't move this to an import, as it would try
// to import the whole file, which tries to use NitroModules., which will
// crash as nitro modules can't init.
// Either I have to fix this, _or_, actually create NitroModules on the UI runtime.
const uiListModuleBoxed = NitroModules.box(uiListModule)
const capturedOnJS = global.nativeFabricUIManager
const uiManagerHelperBoxed = NitroModules.box(uiManagerHelper)

function renderSync() {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.renderSync(capturedOnJS)
}

export interface UiListProps<T extends object> extends Pick<
  ViewProps,
  'style'
> {
  // TODO: can we type enforce that this is a worklet?
  renderItem: (item?: T, index?: number) => React.ReactElement
}

export function UiList<T extends object>({
  renderItem,
  ...props
}: UiListProps<T>) {
  return (
    <UiListHostComponent
      {...props}
      hybridRef={callback((hybridRef) => {
        if (isSetup) return
        isSetup = true

        console.log('hybrid ref received!')
        scheduleOnUI(() => {
          'worklet'

          global.log(
            'Setting makeNativeViewCallback on UiListView on',
            typeof hybridRef.setMakeNativeViewCallback
          )

          const tagToArrayPosition: Record<number, number> = {}
          global.tagToArrayPosition = tagToArrayPosition
          const tagToItemId: Record<number, number> = {}
          global.tagToItemId = tagToItemId

          const uiListModuleUnboxed = uiListModuleBoxed.unbox()

          // TODO: can we enable this somehow as a prop?
          hybridRef.setMakeNativeViewCallback(uiListModuleUnboxed, () => {
            'worklet'

            global.log('Make native view callback called')

            const ref = global.React.createRef()
            global.itemId = (global.itemId ?? 0) + 1
            const NewElement = React.cloneElement(
              renderItem(undefined, undefined),
              {
                ref,
                collapsable: false,
                key: 'itemid-' + global.itemId,
              }
            )

            if (global.elementsRendered == null) {
              global.elementsRendered = []
            }
            const newLength = global.elementsRendered.push(NewElement)
            const currentIndex = newLength - 1

            const ParentContainer = <View>{global.elementsRendered}</View>

            // global.log("Render result:");
            // global.log(ParentContainer.props.children);

            global.Render(ParentContainer, () => {
              global._log('Render complete')
            })

            if (ref.current == null) {
              throw new Error('Ref is null after render')
            }

            // const shadowNode = ref.current.node; // jsi::Object NativeState ShadowNodeWrapper
            global.log('Ref current:', Object.keys(ref.current))
            const tag = ref.current.__nativeTag
            global.log('Ref current nativeTag: ', tag)
            tagToArrayPosition[tag] = currentIndex
            tagToItemId[tag] = global.itemId

            // cause a sync render to create the actual native view
            const start = performance.now()
            renderSync()
            global.log('renderSync took ', performance.now() - start, 'ms')

            return tag
          })

          hybridRef.setUpdateViewCallback(
            uiListModuleUnboxed,
            (reactTag: number, index: number) => {
              'worklet'
              global.log(
                `[JS] Update view callback called for tag ${reactTag} at index ${index}`,
                tagToArrayPosition
              )

              const itemId = tagToItemId[reactTag]
              if (itemId == null) {
                throw new Error('No itemId for tag ' + reactTag)
              }

              // "Rerender the element"
              const NewElement = React.cloneElement(
                renderItem(undefined, index),
                {
                  collapsable: false,
                  key: 'itemid-' + global.itemId,
                }
              )

              // Update the new element in the global array
              const position = tagToArrayPosition[reactTag]
              if (position == null) {
                throw new Error('No position for tag ' + reactTag)
              }
              global.elementsRendered[position] = NewElement

              // Update the parent container
              const ParentContainer = <View>{global.elementsRendered}</View>

              global.Render(ParentContainer, () => {
                global._log('Update Render complete')
              })

              // Cause a sync render to update the actual native view
              const start = performance.now()
              renderSync()
              global.log(
                'Update renderSync took ',
                performance.now() - start,
                'ms'
              )

              return true
            }
          )
        })
      })}
    />
  )
}
