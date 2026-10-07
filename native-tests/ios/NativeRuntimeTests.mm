#import <XCTest/XCTest.h>
#import <ReactCommon/RCTTurboModule.h>
#include "../cpp/RuntimeFixture.h"

using namespace facebook::react;
using namespace list::tests;

@interface ListTestNativeModule : NSObject <RCTBridgeModule, RCTTurboModule> {
  EventEmitterCallback _eventCallback;
  double _counter;
}
- (NSNumber *)increment;
- (void)callback:(RCTResponseSenderBlock)callback;
- (void)promise:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)emit;
@end

namespace {

class FixtureModule final : public ObjCTurboModule {
 public:
  explicit FixtureModule(const InitParams &params) : ObjCTurboModule(params) {
    methodMap_["increment"] = {0, [](jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
      auto &native = static_cast<ObjCTurboModule &>(module);
      return native.invokeObjCMethod(runtime, NumberKind, "increment", @selector(increment), args, count);
    }};
    methodMap_["callback"] = {1, [](jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
      auto &native = static_cast<ObjCTurboModule &>(module);
      return native.invokeObjCMethod(runtime, VoidKind, "callback", @selector(callback:), args, count);
    }};
    methodMap_["promise"] = {0, [](jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
      auto &native = static_cast<ObjCTurboModule &>(module);
      return native.invokeObjCMethod(runtime, PromiseKind, "promise", @selector(promise:reject:), args, count);
    }};
    methodMap_["emit"] = {0, [](jsi::Runtime &runtime, TurboModule &module, const jsi::Value *args, size_t count) {
      auto &native = static_cast<ObjCTurboModule &>(module);
      return native.invokeObjCMethod(runtime, VoidKind, "emit", @selector(emit), args, count);
    }};
    eventEmitterMap_["onChanged"] = std::make_shared<AsyncEventEmitter<id>>();
    setEventEmitterCallback([this](const std::string &name, id value) {
      auto &emitter = static_cast<AsyncEventEmitter<id> &>(*eventEmitterMap_.at(name));
      emitter.emit(value);
    });
  }
};

} // namespace

@implementation ListTestNativeModule

+ (NSString *)moduleName { return @"ListTestNativeModule"; }
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(increment) { return @(++_counter); }
RCT_EXPORT_METHOD(callback:(RCTResponseSenderBlock)callback) { callback(@[@42]); }
RCT_EXPORT_METHOD(promise:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { resolve(@43); }
RCT_EXPORT_METHOD(emit) { _eventCallback("onChanged", @1); }

- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)wrapper {
  _eventCallback = std::move(wrapper->_eventEmitterCallback);
}

- (std::shared_ptr<TurboModule>)getTurboModule:(const ObjCTurboModule::InitParams &)params {
  return std::make_shared<FixtureModule>(params);
}

@end

namespace {

auto factory(ListTestNativeModule *instance) {
  return [instance](const std::shared_ptr<CallInvoker> &invoker) {
    ObjCTurboModule::InitParams params{
      .moduleName = "ListTestNativeModule",
      .instance = instance,
      .jsInvoker = invoker,
      .nativeMethodCallInvoker = std::make_shared<InlineNativeInvoker>(),
      .isSyncModule = false,
    };
    return [instance getTurboModule:params];
  };
}

} // namespace

@interface NativeRuntimeTests : XCTestCase
@end

@implementation NativeRuntimeTests

- (void)runScenario:(std::function<void()>)scenario {
  try {
    scenario();
  } catch (const std::exception &error) {
    XCTFail(@"%s", error.what());
  }
}

- (void)testTwoWrappersShareNativeState {
  auto instance = [ListTestNativeModule new];
  auto createModule = factory(instance);
  [self runScenario:[&] { checkSharedState(createModule); }];
}

- (void)testCallbacksAndPromisesStayInTheirRuntime {
  auto instance = [ListTestNativeModule new];
  auto createModule = factory(instance);
  [self runScenario:[&] { checkCallbackAndPromiseRouting(createModule); }];
}

- (void)testSeparateInstancesKeepRootEventCallback {
  auto createModule = [](const std::shared_ptr<CallInvoker> &invoker) {
    auto instance = [ListTestNativeModule new];
    auto create = factory(instance);
    return create(invoker);
  };
  [self runScenario:[&] { checkEventRouting(createModule); }];
}

- (void)testSharedInstanceKeepsRootEventCallback {
  auto instance = [ListTestNativeModule new];
  auto createModule = factory(instance);
  [self runScenario:[&] { checkEventRouting(createModule); }];
}

@end
