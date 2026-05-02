import { scheduleOnUI } from 'react-native-worklets'
import { uiListModule } from './UiListModule'
import { uiManagerHelper } from './renderer/fabric/UiManagerHelper'
import { List } from './views/List'
import { Platform } from 'react-native'
import { getReactFabricRenderer } from './renderer/react/ReactFabricRenderer'

export { ViewHolder } from './specs/ViewHolder.nitro'
export { IOSWorkletsModuleProxyHolder } from './specs/IOSWorkletsModuleProxyHolder.nitro'
export type { NativeListItem } from './specs/UiListView.nitro'
export type {
  ListItemSize,
  ListKey,
  ListProps,
  ListRef,
  ListRenderer,
} from './views/List'

const boxed = uiListModule
const nativeFabricUIManager = globalThis.nativeFabricUIManager

function setup() {
  // TODO: ask SWM if they can remove their JS thread checks, then we could just access this from the UI thread.
  const iosWorkletsModuleHolder =
    Platform.OS === 'ios' ? uiListModule.iosGetWorkletsModule() : null
  scheduleOnUI(() => {
    'worklet'
    globalThis.nativeFabricUIManager = nativeFabricUIManager
    boxed.setupExternalSurface(iosWorkletsModuleHolder)

    // This will setup the react instance on the UI runtime:
    getReactFabricRenderer()
  })
}
setup()

export { List, uiListModule, uiManagerHelper }
