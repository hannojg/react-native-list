import { NitroModules } from 'react-native-nitro-modules'
import { UiManagerHelper } from '../../specs/UIManagerHelper.nitro'

export const uiManagerHelper =
  NitroModules.createHybridObject<UiManagerHelper>('UiManagerHelper')
