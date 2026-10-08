#import <XCTest/XCTest.h>
#import <ReactCommon/RCTTurboModule.h>
#include "../cpp/RuntimeFixture.h"
#import "../../package/ios/Utils/BorrowedModule.mm"
#import "../../package/ios/Utils/TurboModuleManager.mm"

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
@property(nonatomic) NSUInteger initializations;
@property(nonatomic) NSUInteger invalidations;
@property(nonatomic) NSUInteger bindingsInstallations;
- (void)initialize;
- (void)invalidate;
- (void)installJSIBindingsWithRuntime:(jsi::Runtime &)runtime;
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
- (void)initialize { ++_initializations; }
- (void)invalidate { ++_invalidations; }
- (void)installJSIBindingsWithRuntime:(jsi::Runtime &)runtime { ++_bindingsInstallations; }

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

@interface RCTTurboModuleManager (ListRuntimeTests)
- (std::shared_ptr<TurboModule>)provideTurboModule:(const char *)name runtime:(jsi::Runtime *)runtime;
@end

@interface ListTestModuleDelegate : NSObject <RCTTurboModuleManagerDelegate>
@property(nonatomic, strong) ListTestNativeModule *module;
@end

@implementation ListTestModuleDelegate
- (Class)getModuleClassFromName:(const char *)name {
  return std::string(name) == "ListTestNativeModule" ? ListTestNativeModule.class : Nil;
}
- (id<RCTTurboModule>)getModuleInstanceFromClass:(Class)moduleClass {
  return moduleClass == ListTestNativeModule.class ? self.module : nil;
}
- (std::shared_ptr<TurboModule>)getTurboModule:(const std::string &)name jsInvoker:(std::shared_ptr<CallInvoker>)invoker {
  if (name == "HandwrittenCppModule") {
    return std::make_shared<HandwrittenCppModule>(invoker);
  }
  return nullptr;
}
@end

namespace {

auto factory(ListTestNativeModule *instance, bool uiFirst = false) {
  return [instance, uiFirst, wrappers = size_t{0}](const std::shared_ptr<CallInvoker> &invoker) mutable {
    auto nativeInvoker = std::make_shared<InlineNativeInvoker>();
    id<RCTBridgeModule, RCTTurboModule> target = instance;
    bool isUi = uiFirst ? wrappers == 0 : wrappers > 0;
    if (isUi) {
      target = [[BorrowedModule alloc] initWithModule:instance nativeInvoker:nativeInvoker isSyncModule:NO];
    }
    ++wrappers;
    ObjCTurboModule::InitParams params{
      .moduleName = "ListTestNativeModule",
      .instance = target,
      .jsInvoker = invoker,
      .nativeMethodCallInvoker = nativeInvoker,
      .isSyncModule = false,
    };
    return [target getTurboModule:params];
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

- (void)testRootEventsSurviveUiRuntimeTeardown {
  auto instance = [ListTestNativeModule new];
  auto createModule = factory(instance);
  [self runScenario:[&] { checkRootEventsAfterUiTeardown(createModule); }];
}

- (void)testUiWrapperCanBeCreatedBeforeRootWrapper {
  auto instance = [ListTestNativeModule new];
  auto createModule = factory(instance, true);
  [self runScenario:[&] { checkUiWrapperBeforeRoot(createModule); }];
}

- (void)testBorrowedModuleDoesNotOwnNativeLifecycleOrBindings {
  auto instance = [ListTestNativeModule new];
  auto nativeInvoker = std::make_shared<InlineNativeInvoker>();
  auto borrowed = [[BorrowedModule alloc] initWithModule:instance nativeInvoker:nativeInvoker isSyncModule:NO];
  [instance initialize];
  [borrowed initialize];
  [borrowed invalidate];
  XCTAssertEqual(instance.initializations, 1);
  XCTAssertEqual(instance.invalidations, 0);
  XCTAssertTrue([instance respondsToSelector:@selector(installJSIBindingsWithRuntime:)]);
  XCTAssertFalse([borrowed respondsToSelector:@selector(installJSIBindingsWithRuntime:)]);
  XCTAssertFalse([borrowed respondsToSelector:@selector(installJSIBindingsWithRuntime:callInvoker:)]);
  [instance invalidate];
  XCTAssertEqual(instance.invalidations, 1);
}

- (void)testHandwrittenCppSharedStateExpectedFailure {
  auto options = [XCTExpectedFailureOptions new];
  options.issueMatcher = ^BOOL(XCTIssue *issue) {
    return [issue.compactDescription containsString:@"native.increment() did not equal 2.000000"];
  };
  XCTExpectFailureWithOptions(@"Handwritten C++ backends are not shared across runtime-local wrappers yet.", options);
  auto delegate = [ListTestModuleDelegate new];
  auto createModule = [delegate, rootManager = (RCTTurboModuleManager *)nil](const std::shared_ptr<CallInvoker> &invoker) mutable {
    if (rootManager == nil) {
      rootManager = [[RCTTurboModuleManager alloc] initWithBridgeProxy:nil
                                               bridgeModuleDecorator:nil
                                                            delegate:delegate
                                                           jsInvoker:invoker];
      return [rootManager provideTurboModule:"HandwrittenCppModule" runtime:nullptr];
    }
    auto uiManager = [[TurboModuleManager alloc] initWithRootManager:rootManager
                                                          bridgeProxy:nil
                                                bridgeModuleDecorator:nil
                                                             delegate:delegate
                                                            jsInvoker:invoker];
    return [uiManager provideTurboModule:"HandwrittenCppModule" runtime:nullptr];
  };
  [self runScenario:[&] { checkSharedState(createModule); }];
}

- (void)testManagersBorrowOneInstanceAndKeepRootOwnership {
  auto instance = [ListTestNativeModule new];
  auto delegate = [ListTestModuleDelegate new];
  delegate.module = instance;
  RuntimeFixture root;
  RuntimeFixture ui;
  auto rootManager = [[RCTTurboModuleManager alloc] initWithBridgeProxy:nil
                                                bridgeModuleDecorator:nil
                                                             delegate:delegate
                                                            jsInvoker:root.invoker];
  auto uiManager = [[TurboModuleManager alloc] initWithRootManager:rootManager
                                                        bridgeProxy:nil
                                              bridgeModuleDecorator:nil
                                                           delegate:delegate
                                                          jsInvoker:ui.invoker];
  auto rootModule = [rootManager provideTurboModule:"ListTestNativeModule" runtime:&root.runtime()];
  auto uiModule = [uiManager provideTurboModule:"ListTestNativeModule" runtime:&ui.runtime()];
  XCTAssertTrue(rootModule != nullptr);
  XCTAssertTrue(uiModule != nullptr);
  if (rootModule == nullptr || uiModule == nullptr) {
    return;
  }
  XCTAssertTrue(rootModule != uiModule);
  auto cachedUiModule = [uiManager provideTurboModule:"ListTestNativeModule" runtime:&ui.runtime()];
  XCTAssertTrue(uiModule == cachedUiModule);
  XCTAssertEqual(instance.initializations, 1);
  XCTAssertEqual(instance.bindingsInstallations, 1);
  root.install(rootModule);
  ui.install(uiModule);
  [self runScenario:[&] {
    root.expectNumber("native.increment()", 1);
    ui.expectNumber("native.increment()", 2);
    root.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
    ui.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
    [instance emit];
    root.invoker->drain();
    ui.invoker->drain();
    root.expectNumber("events", 1);
    ui.expectNumber("events", 0);
  }];
  [uiManager invalidate];
  XCTAssertEqual(instance.invalidations, 0);
  [self runScenario:[&] {
    [instance emit];
    root.invoker->drain();
    root.expectNumber("events", 2);
  }];
  [rootManager invalidate];
  XCTAssertEqual(instance.invalidations, 1);
}

@end
