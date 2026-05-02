import { NitroModules } from 'react-native-nitro-modules'
import { uiListModule } from '../../UiListModule'
import { uiManagerHelper } from './UiManagerHelper'

export const uiListModuleBoxed = NitroModules.box(uiListModule)
const capturedOnJS = global.nativeFabricUIManager
const uiManagerHelperBoxed = NitroModules.box(uiManagerHelper)

export function renderSyncWorklet() {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.renderSync(capturedOnJS)
}
