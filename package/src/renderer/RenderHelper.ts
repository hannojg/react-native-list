import { NitroModules } from 'react-native-nitro-modules'
import { uiListModule } from '../UiListModule'
import { uiManagerHelper } from './UiManagerHelper'

// Either I have to fix this, _or_, actually create NitroModules on the UI runtime.
export const uiListModuleBoxed = NitroModules.box(uiListModule)
const capturedOnJS = global.nativeFabricUIManager
const uiManagerHelperBoxed = NitroModules.box(uiManagerHelper)

export function renderSyncWorklet() {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.renderSync(capturedOnJS)
}
