/**
 * interface Adapter<ViewTypes extends enum> {
 *  create(
 *      createViewHolder: (viewType: ViewTypes) => ViewHolder,
 *      onBindViewHolder: (viewHolder: ViewHolder, item: any, index: number) -> void,
 *  )
 *
 *  changeDataSet(newDataSet: Array<any>) -> calls notifyDataSetChanged
 *  insertItem(item: any, index: number) -> calls notifyItemInserted
 *  removeItem(index: number) -> calls notifyItemRemoved
 *
 *  // hm
 *  notifyDataSetChanged()
 *  notifyItemInserted(index: number)
 *  notifyItemRemoved(index: number)
 * }
 *
 *  const adapter = Adapter.create(
 *      () => <ViewHolder ... />,
 *      (viewHolder, item, index) => {
 *         viewHolder.text = item.text;
 *      }
 *
 * <RecyclerView
 *  adapter={Adapter}
 * />
 */

import { scheduleOnUI } from 'react-native-worklets'
import { uiListModule } from './UiListModule'
import { uiManagerHelper } from './UiManagerHelper'
import { UiList } from './UiList'
import { Platform } from 'react-native'

export { Adapter, AdapterFactory } from './specs/Adapter.nitro'
export { ViewHolder } from './specs/ViewHolder.nitro'
export { IOSWorkletsModuleProxyHolder } from './specs/IOSWorkletsModuleProxyHolder.nitro'

// @ts-expect-error shrug
import { setupWorklet } from './ReactFabricMirror.bundle'
import { BoxedHybridObject, NitroModules } from 'react-native-nitro-modules'
import { UiManagerHelper } from './specs/UIManagerHelper.nitro'

const boxed = uiListModule
export function setup() {
  // TODO: ask SWM if they can remove their JS thread checks, then we could just access this from the UI thread.
  const iosWorkletsModuleHolder =
    Platform.OS === 'ios' ? uiListModule.iosGetWorkletsModule() : null
  scheduleOnUI(() => {
    'worklet'
    const logUiRuntimeGlobals = (label: string) => {
      'worklet'
      global._log(
        `[nitro-list setup] ${label} RN$Bridgeless=${String(global['RN$Bridgeless'])}`
      )
      global._log(
        `[nitro-list setup] ${label} typeof global.nativeModuleProxy=${typeof global.nativeModuleProxy}`
      )
      global._log(
        `[nitro-list setup] ${label} typeof global.__turboModuleProxy=${typeof global.__turboModuleProxy}`
      )
    }

    logUiRuntimeGlobals('before setupExternalSurface')
    boxed.setupExternalSurface(iosWorkletsModuleHolder)
    logUiRuntimeGlobals('after setupExternalSurface')

    scheduleOnUI(() => {
      'worklet'
      logUiRuntimeGlobals('next UI tick after setupExternalSurface')
    })
  })

  scheduleOnUI(setupWorklet)
}

// TODO: this import doesn't work right now in bundle mode :/
// @ts-expect-error
const capturedOnJS = global.nativeFabricUIManager
let uiManagerHelperBoxed: BoxedHybridObject<UiManagerHelper> =
  NitroModules.box(uiManagerHelper)
export function renderSync() {
  // todo: we might have to pass uiManagerHelper here, or consume from global?
  'worklet'

  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.renderSync(capturedOnJS)
}

export { UiList, uiListModule, uiManagerHelper }
