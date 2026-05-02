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
import { uiManagerHelper } from './renderer/UiManagerHelper'
import { List } from './views/List'
import { Platform } from 'react-native'

export { Adapter, AdapterFactory } from './specs/Adapter.nitro'
export { ViewHolder } from './specs/ViewHolder.nitro'
export { IOSWorkletsModuleProxyHolder } from './specs/IOSWorkletsModuleProxyHolder.nitro'

const boxed = uiListModule
const nativeFabricUIManager = global.nativeFabricUIManager

function setup() {
  // TODO: ask SWM if they can remove their JS thread checks, then we could just access this from the UI thread.
  const iosWorkletsModuleHolder =
    Platform.OS === 'ios' ? uiListModule.iosGetWorkletsModule() : null
  scheduleOnUI(() => {
    'worklet'
    global.nativeFabricUIManager = nativeFabricUIManager
    boxed.setupExternalSurface(iosWorkletsModuleHolder)

    require('react-native-list/src/ReactFabricMirror.bundle')
  })
}
setup()

export { List, uiListModule, uiManagerHelper }
