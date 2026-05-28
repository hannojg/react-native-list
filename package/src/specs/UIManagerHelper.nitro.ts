import { CustomType, HybridObject } from 'react-native-nitro-modules'

type UiManagerBidningType = {
  _stubToMakeNitroHappy_doesNotExist_doNotUse: void
}

export type UiManagerBinding = CustomType<
  UiManagerBidningType,
  'std::shared_ptr<facebook::react::UIManagerBinding>',
  { include: 'JSIConverter+UIManagerBinding.hpp' }
>

type ShadowNodeListType = {
  _stubToMakeNitroHappy_doesNotExist_doNotUse: void
}

export type ShadowNodeList = CustomType<
  ShadowNodeListType,
  'facebook::react::ShadowNode::UnsharedListOfShared',
  { include: 'JSIConverter+ShadowNodeList.hpp' }
>

export interface UiManagerHelper extends HybridObject<{
  android: 'c++'
  ios: 'c++'
}> {
  completeRootSync(
    nativeFabricUIManager: UiManagerBinding,
    surfaceId: number,
    childSet: ShadowNodeList
  ): void
  registerManagedSurface(surfaceId: number): void
  unregisterManagedSurface(surfaceId: number): void
}
