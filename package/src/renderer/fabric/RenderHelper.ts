import { NitroModules } from 'react-native-nitro-modules'
import { uiListModule } from '../../UiListModule'
import { uiManagerHelper } from './UiManagerHelper'

export const uiListModuleBoxed = NitroModules.box(uiListModule)
const capturedOnJS = global.nativeFabricUIManager
const uiManagerHelperBoxed = NitroModules.box(uiManagerHelper)

/**
 * Will trigger the mounting layer to synchronously render all pending updates that
 * were posted by react to the UIManager.
 */
export function renderSyncWorklet(surfaceId: number) {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.renderSync(capturedOnJS, surfaceId)
}

export function registerManagedSurfaceWorklet(surfaceId: number) {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.registerManagedSurface(surfaceId)
}

export function unregisterManagedSurfaceWorklet(surfaceId: number) {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.unregisterManagedSurface(surfaceId)
}
