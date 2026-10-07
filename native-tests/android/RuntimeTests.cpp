#include <ReactCommon/JavaTurboModule.h>
#include <fbjni/fbjni.h>
#include <folly/dynamic.h>
#include <jsi/JSIDynamic.h>
#include "../cpp/RuntimeFixture.h"

using namespace facebook;
using namespace facebook::react;
using namespace list::tests;

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

struct JFixtureModule : jni::JavaClass<JFixtureModule> {
  static constexpr auto kJavaDescriptor = "Lcom/hannojg/list/runtimetests/FixtureModule;";
};

struct NativeRuntimeTests : jni::JavaClass<NativeRuntimeTests> {
  static constexpr auto kJavaDescriptor = "Lcom/hannojg/list/runtimetests/NativeRuntimeTests;";

  static void runScenario(jni::alias_ref<jclass>, jint scenario, jni::alias_ref<JFixtureModule> root, jni::alias_ref<JFixtureModule> ui) {
    size_t wrappers = 0;
    auto createModule = [&](const std::shared_ptr<CallInvoker> &invoker) {
      auto instance = wrappers == 0 ? root : ui;
      ++wrappers;
      JavaTurboModule::InitParams params{
        .moduleName = "ListTestNativeModule",
        .instance = instance,
        .jsInvoker = invoker,
        .nativeMethodCallInvoker = std::make_shared<InlineNativeInvoker>(),
      };
      return std::make_shared<FixtureModule>(params);
    };
    switch (scenario) {
      case 0: checkSharedState(createModule); break;
      case 1: checkCallbackAndPromiseRouting(createModule); break;
      case 2: checkEventRouting(createModule); break;
      case 3: checkEventRouting(createModule); break;
      default: throw std::runtime_error("Unknown runtime test scenario");
    }
  }
};

} // namespace

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *) {
  return jni::initialize(vm, [] {
    NativeRuntimeTests::javaClassLocal()->registerNatives({
      makeNativeMethod("runScenario", NativeRuntimeTests::runScenario),
    });
  });
}
