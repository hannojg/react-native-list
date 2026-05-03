import { HybridObject } from 'react-native-nitro-modules'

export interface NativeListLayout extends HybridObject<{
  android: 'kotlin'
  ios: 'swift'
}> {}
