#pragma once

#include "RuntimeLocalJavaTurboModule.h"
#include <ReactCommon/TurboModuleManagerDelegate.h>
#include <react/jni/CxxModuleWrapperBase.h>

namespace margelo::nitro::reactnativelist {

struct JBorrowedModule : facebook::jni::JavaClass<JBorrowedModule> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/reactnativelist/BorrowedModule;";
  static auto create(facebook::jni::alias_ref<facebook::react::JNativeModule> module) {
    return newInstance(module);
  }
};

// Builds fresh JSI wrappers from generated metadata without sharing runtime-owned JSI state.
// Native calls still target the root-owned module through the Java borrowing adapter.
class TurboModuleManagerDelegate : public facebook::jni::HybridClass<
    TurboModuleManagerDelegate, facebook::react::TurboModuleManagerDelegate> {
 public:
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/reactnativelist/TurboModuleManagerDelegate;";
  using RootDelegate = facebook::react::TurboModuleManagerDelegate;

  static facebook::jni::local_ref<jhybriddata> initHybrid(
      facebook::jni::alias_ref<facebook::jni::JClass>, facebook::jni::alias_ref<RootDelegate::javaobject> root) {
    return makeCxxInstance(root);
  }

  static void registerNatives() {
    registerHybrid({makeNativeMethod("initHybrid", TurboModuleManagerDelegate::initHybrid)});
  }

  std::shared_ptr<facebook::react::TurboModule> getTurboModule(
      const std::string &name, const facebook::react::JavaTurboModule::InitParams &params) override {
    auto rootDelegate = root_->cthis();
    auto metadata = rootDelegate->getTurboModule(name, params);
    if (metadata == nullptr) {
      return nullptr;
    }
    static auto borrowedClass = JBorrowedModule::javaClassStatic();
    static auto getNativeModule = borrowedClass->getMethod<facebook::react::JNativeModule::javaobject()>("getNativeModule");
    auto nativeModule = getNativeModule(params.instance);
    auto localParams = params;
    localParams.instance = nativeModule;
    return std::make_shared<RuntimeLocalJavaTurboModule>(localParams, *metadata);
  }

  std::shared_ptr<facebook::react::TurboModule> getTurboModule(
      const std::string &name, const std::shared_ptr<facebook::react::CallInvoker> &invoker) override {
    auto rootDelegate = root_->cthis();
    return rootDelegate->getTurboModule(name, invoker);
  }

 private:
  friend HybridBase;
  explicit TurboModuleManagerDelegate(facebook::jni::alias_ref<RootDelegate::javaobject> root)
      : root_(facebook::jni::make_global(root)) {}
  facebook::jni::global_ref<RootDelegate::javaobject> root_;
};

} // namespace margelo::nitro::reactnativelist
