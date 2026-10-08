#include <ReactCommon/JavaTurboModule.h>
#include <fbjni/fbjni.h>
#include <folly/dynamic.h>
#include <jsi/JSIDynamic.h>
#include "../cpp/RuntimeFixture.h"
#include "../../package/android/src/main/cpp/TurboModuleManagerDelegate.h"

using namespace facebook;
using namespace facebook::react;
using namespace list::tests;
using namespace margelo::nitro::reactnativelist;

namespace {

class FixtureModule final : public JavaTurboModule {
 public:
  explicit FixtureModule(const InitParams &params) : JavaTurboModule(params) {
    methodMap_["increment"] = {0, increment};
    methodMap_["callback"] = {1, callback};
    methodMap_["promise"] = {0, promise};
    methodMap_["emit"] = {0, emit};
    eventEmitterMap_["onChanged"] = std::make_shared<AsyncEventEmitter<folly::dynamic>>();
    configureEventEmitterCallback();
  }

 private:
  static jsi::Value increment(jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
    auto &native = static_cast<JavaTurboModule &>(module);
    static jmethodID method = nullptr;
    return native.invokeJavaMethod(runtime, NumberKind, "increment", "()D", args, count, method);
  }

  static jsi::Value callback(jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
    auto &native = static_cast<JavaTurboModule &>(module);
    static jmethodID method = nullptr;
    return native.invokeJavaMethod(runtime, VoidKind, "callback", "(Lcom/facebook/react/bridge/Callback;)V", args, count, method);
  }

  static jsi::Value promise(jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
    auto &native = static_cast<JavaTurboModule &>(module);
    static jmethodID method = nullptr;
    return native.invokeJavaMethod(runtime, PromiseKind, "promise", "(Lcom/facebook/react/bridge/Promise;)V", args, count, method);
  }

  static jsi::Value emit(jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
    auto &native = static_cast<JavaTurboModule &>(module);
    static jmethodID method = nullptr;
    return native.invokeJavaMethod(runtime, VoidKind, "emit", "()V", args, count, method);
  }
};

struct JFixtureModule : jni::JavaClass<JFixtureModule, JNativeModule> {
  static constexpr auto kJavaDescriptor = "Lcom/hannojg/list/runtimetests/FixtureModule;";
};

class FixtureTurboModuleManagerDelegate : public jni::HybridClass<
    FixtureTurboModuleManagerDelegate, facebook::react::TurboModuleManagerDelegate> {
 public:
  static constexpr auto kJavaDescriptor = "Lcom/hannojg/list/runtimetests/FixtureTurboModuleManagerDelegate;";

  static jni::local_ref<jhybriddata> initHybridForTests(jni::alias_ref<jclass>) {
    return makeCxxInstance();
  }

  static void registerNatives() {
    registerHybrid({makeNativeMethod("initHybridForTests", initHybridForTests)});
  }

  std::shared_ptr<TurboModule> getTurboModule(
      const std::string &, const JavaTurboModule::InitParams &) override {
    return nullptr;
  }

  std::shared_ptr<TurboModule> getTurboModule(
      const std::string &name, const std::shared_ptr<CallInvoker> &invoker) override {
    if (name == "HandwrittenCppModule") {
      return std::make_shared<HandwrittenCppModule>(invoker);
    }
    return nullptr;
  }

 private:
  friend HybridBase;
  FixtureTurboModuleManagerDelegate() = default;
};

struct NativeRuntimeTests : jni::JavaClass<NativeRuntimeTests> {
  static constexpr auto kJavaDescriptor = "Lcom/hannojg/list/runtimetests/NativeRuntimeTests;";

  static void runScenario(jni::alias_ref<jclass>, jint scenario, jni::alias_ref<JFixtureModule> root, jni::alias_ref<JFixtureModule> ui) {
    size_t wrappers = 0;
    auto createModule = [&](const std::shared_ptr<CallInvoker> &invoker) -> std::shared_ptr<TurboModule> {
      bool isUi = scenario == 6 ? wrappers == 0 : wrappers > 0;
      auto instance = isUi ? ui : root;
      ++wrappers;
      JavaTurboModule::InitParams params{
        .moduleName = "ListTestNativeModule",
        .instance = instance,
        .jsInvoker = invoker,
        .nativeMethodCallInvoker = std::make_shared<InlineNativeInvoker>(),
      };
      if (isUi) {
        auto nativeModule = jni::static_ref_cast<JNativeModule::javaobject>(instance);
        auto borrowed = JBorrowedModule::create(nativeModule);
        auto metadataParams = params;
        metadataParams.instance = borrowed;
        auto metadata = std::make_shared<FixtureModule>(metadataParams);
        return std::make_shared<RuntimeLocalJavaTurboModule>(params, *metadata);
      }
      return std::make_shared<FixtureModule>(params);
    };
    switch (scenario) {
      case 0: checkSharedState(createModule); break;
      case 1: checkCallbackAndPromiseRouting(createModule); break;
      case 2: checkEventRouting(createModule); break;
      case 3: checkEventRouting(createModule); break;
      case 5: checkRootEventsAfterUiTeardown(createModule); break;
      case 6: checkUiWrapperBeforeRoot(createModule); break;
      default: throw std::runtime_error("Unknown runtime test scenario");
    }
  }

  static void runCppScenario(jni::alias_ref<jclass>,
      jni::alias_ref<facebook::react::TurboModuleManagerDelegate::javaobject> root,
      jni::alias_ref<facebook::react::TurboModuleManagerDelegate::javaobject> ui) {
    auto rootDelegate = root->cthis();
    auto uiDelegate = ui->cthis();
    size_t wrappers = 0;
    auto createModule = [&](const std::shared_ptr<CallInvoker> &invoker) {
      auto delegate = wrappers == 0 ? rootDelegate : uiDelegate;
      ++wrappers;
      return delegate->getTurboModule("HandwrittenCppModule", invoker);
    };
    checkSharedState(createModule);
  }
};

} // namespace

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    NativeRuntimeTests::javaClassLocal()->registerNatives({
      makeNativeMethod("runScenario", NativeRuntimeTests::runScenario),
      makeNativeMethod("runCppScenario", NativeRuntimeTests::runCppScenario),
    });
    FixtureTurboModuleManagerDelegate::registerNatives();
    margelo::nitro::reactnativelist::TurboModuleManagerDelegate::registerNatives();
  });
}
