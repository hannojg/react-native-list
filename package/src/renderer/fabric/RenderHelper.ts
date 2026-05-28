import { NitroModules } from 'react-native-nitro-modules'
import { uiListModule } from '../../UiListModule'
import { uiManagerHelper } from './UiManagerHelper'
import type { ShadowNodeList } from '../../specs/UIManagerHelper.nitro'

export const uiListModuleBoxed = NitroModules.box(uiListModule)
const capturedOnJS = global.nativeFabricUIManager
const uiManagerHelperBoxed = NitroModules.box(uiManagerHelper)

export function completeRootSyncWorklet(
  surfaceId: number,
  childSet: ShadowNodeList
) {
  'worklet'
  const uiManagerHelperUnboxed = uiManagerHelperBoxed.unbox()
  uiManagerHelperUnboxed.completeRootSync(capturedOnJS, surfaceId, childSet)
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
