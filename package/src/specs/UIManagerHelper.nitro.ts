import { CustomType, HybridObject } from 'react-native-nitro-modules'

type UiManagerBidningType = {
  _stubToMakeNitroHappy_doesNotExist_doNotUse: void
}

export type UiManagerBinding = CustomType<
  UiManagerBidningType,
  'std::shared_ptr<facebook::react::UIManagerBinding>',
  { include: 'JSIConverter+UIManagerBinding.hpp' }
>

export interface UiManagerHelper extends HybridObject<{ android: 'c++' }> {
  renderSync(nativeFabricUIManager: UiManagerBinding): void
}
