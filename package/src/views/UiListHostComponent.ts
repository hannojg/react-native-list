import { getHostComponent } from 'react-native-nitro-modules'
import { UiListViewMethods, UiListViewProps } from '../specs/UiListView.nitro'
import UiListViewConfig from '../../nitrogen/generated/shared/json/UiListViewConfig.json'

export const UiListHostComponent = getHostComponent<
  UiListViewProps,
  UiListViewMethods
>('UiListView', () => UiListViewConfig)
