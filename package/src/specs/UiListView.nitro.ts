import {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
  Sync,
} from 'react-native-nitro-modules'
import {
  NativeListDataSource,
  NativeListItem,
} from './NativeListDataSource.nitro'
import { NativeListLayout } from './NativeListLayout.nitro'
import { UiListModule } from './UIListModule.nitro'

export interface UiListViewProps extends HybridViewProps {}

export interface UiListViewMethods extends HybridViewMethods {
  setListCallbacks(
    uiListModule: UiListModule,
    createView: Sync<(type: string) => number>,
    updateView: Sync<
      (reactTag: number, item: NativeListItem, index: number) => boolean
    >
  ): void

  setDataSource(dataSource: NativeListDataSource): void
  setLayout(layout: NativeListLayout): void
  getSurfaceId(): number
  disposeRendererSurface(): void
}

export type UiListView = HybridView<UiListViewProps, UiListViewMethods>
