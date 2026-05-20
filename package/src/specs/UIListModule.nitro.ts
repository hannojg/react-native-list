import { HybridObject } from 'react-native-nitro-modules'
import type { IOSWorkletsModuleProxyHolder } from './IOSWorkletsModuleProxyHolder.nitro'
// import { ViewHolder } from './ViewHolder.nitro'

export interface UiListModule extends HybridObject<{
  android: 'kotlin'
  ios: 'swift'
}> {
  // TODO: on iOS getting the worklets proxy has JS thread asserts, so we have to get it from JS and pass it to the UI thread. Maybe we can change that in nitro at some point?
  iosGetWorkletsModule(): IOSWorkletsModuleProxyHolder
  setupRuntime(workletsModuleHolder: IOSWorkletsModuleProxyHolder | null): void
  //   renderAndGetView(tag: number): ViewHolder
}
