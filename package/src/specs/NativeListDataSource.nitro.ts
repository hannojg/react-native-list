import { AnyMap, HybridObject, Sync } from 'react-native-nitro-modules'

export interface NativeListItem {
  key: string
  type: string
  width?: number
  height?: number
  data: AnyMap
}

export interface NativeListDataSource extends HybridObject<{
  android: 'kotlin'
  ios: 'swift'
}> {
  setContentEqualCallback(
    isContentEqual: Sync<
      (oldItem: NativeListItem, newItem: NativeListItem) => boolean
    >
  ): void

  replaceData(items: NativeListItem[], animated: boolean): void
  insertItem(index: number, item: NativeListItem): void
  updateItem(index: number, item: NativeListItem): void
  removeItem(index: number): void
  moveItem(fromIndex: number, toIndex: number): void
  getCount(): number
  getItem(index: number): NativeListItem
}
