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
import { uiManagerHelper } from './renderer/fabric/UiManagerHelper'
import { List } from './views/List'
import { Platform } from 'react-native'
import { getReactFabricRenderer } from './renderer/react/ReactFabricRenderer'

export { Adapter, AdapterFactory } from './specs/Adapter.nitro'
export { ViewHolder } from './specs/ViewHolder.nitro'
export { IOSWorkletsModuleProxyHolder } from './specs/IOSWorkletsModuleProxyHolder.nitro'

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
