#pragma once

#include <ReactCommon/JavaTurboModule.h>
#include <folly/dynamic.h>

namespace margelo::nitro::reactnativelist {

class TurboModuleMetadata : public facebook::react::TurboModule {
 public:
  static auto methods(const TurboModule &source) {
    auto member = &TurboModuleMetadata::methodMap_;
    return source.*member;
  }

  static auto events(const TurboModule &source) {
    auto member = &TurboModuleMetadata::eventEmitterMap_;
    return source.*member;
  }
};

// Codegen handlers dispatch through JavaTurboModule, not the generated subclass.
// Read only their static metadata; never copy a wrapper's runtime-owned JSI state.
class RuntimeLocalJavaTurboModule final : public facebook::react::JavaTurboModule {
 public:
  RuntimeLocalJavaTurboModule(const InitParams &params, const facebook::react::TurboModule &metadata)
      : JavaTurboModule(params) {
    methodMap_ = TurboModuleMetadata::methods(metadata);
    auto events = TurboModuleMetadata::events(metadata);
    for (const auto &[name, emitter] : events) {
      eventEmitterMap_[name] = std::make_shared<facebook::react::AsyncEventEmitter<folly::dynamic>>();
    }
  }
};

} // namespace margelo::nitro::reactnativelist
