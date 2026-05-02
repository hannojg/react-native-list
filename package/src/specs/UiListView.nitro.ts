import {
  AnyMap,
  HybridView,
  HybridViewMethods,
  HybridViewProps,
  Sync,
} from 'react-native-nitro-modules'
import { UiListModule } from './UIListModule.nitro'

export interface NativeListItem {
  key: string
  type: string
  width: number
  height: number
  data: AnyMap
}

export interface UiListViewProps extends HybridViewProps {}

export interface UiListViewMethods extends HybridViewMethods {
  setListCallbacks(
    uiListModule: UiListModule,
    createView: Sync<(type: string) => number>,
    updateView: Sync<
      (reactTag: number, item: NativeListItem, index: number) => boolean
    >,
    isContentEqual: Sync<
      (oldItem: NativeListItem, newItem: NativeListItem) => boolean
    >
  ): void

  setData(items: NativeListItem[], animated: boolean): void
  insertItem(index: number, item: NativeListItem): void
  updateItem(index: number, item: NativeListItem): void
  removeItem(index: number): void
  moveItem(fromIndex: number, toIndex: number): void
}

export type UiListView = HybridView<UiListViewProps, UiListViewMethods>
