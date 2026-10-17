#import <XCTest/XCTest.h>
#import <ReactCommon/RCTTurboModule.h>
#include "../cpp/RuntimeFixture.h"
#import "../../package/ios/Utils/BorrowedModule.mm"
#import "../../package/ios/Utils/TurboModuleManager.mm"
#import "../../package/ios/Utils/SurfaceMountingSupport.hpp"
#include <react/renderer/components/root/RootComponentDescriptor.h>
#include <react/renderer/mounting/ShadowTree.h>
#include <react/renderer/mounting/ShadowTreeDelegate.h>

using namespace facebook::react;
using namespace list::tests;

namespace {
class MountingTestShadowTreeDelegate final : public ShadowTreeDelegate {
 public:
  RootShadowNode::Unshared shadowTreeWillCommit(
      const ShadowTree &, const RootShadowNode::Shared &,
      const RootShadowNode::Unshared &root, const ShadowTree::CommitOptions &) const override {
    return root;
  }
  void shadowTreeDidFinishTransaction(std::shared_ptr<const MountingCoordinator>, bool) const override {}
  void shadowTreeDidFinishReactCommit(const ShadowTree &) const override {}
  void shadowTreeDidPromoteReactRevision(const ShadowTree &) const override {}
};

struct MountingTestSurface {
  ContextContainer context;
  MountingTestShadowTreeDelegate delegate;
  ShadowTree tree;
  std::shared_ptr<const MountingCoordinator> coordinator;

  explicit MountingTestSurface(SurfaceId surfaceId)
      : tree(surfaceId, {}, {}, delegate, context) {
    tree.commit([](const RootShadowNode &root) {
      auto clone = root.ShadowNode::clone({});
      return std::static_pointer_cast<RootShadowNode>(clone);
    }, {.mountSynchronously = true, .source = ShadowTree::CommitSource::Unknown});
    coordinator = tree.getMountingCoordinator();
  }
};
}

@interface ListMountingTestDelegate : NSObject <RCTMountingManagerDelegate>
@property(nonatomic, strong) NSMutableArray<NSString *> *events;
@property(nonatomic, copy) void (^willMount)(RCTMountingManager *, ReactTag);
@end

@implementation ListMountingTestDelegate
- (instancetype)init {
  if (self = [super init]) _events = [NSMutableArray new];
  return self;
}
- (void)mountingManager:(RCTMountingManager *)manager willMountComponentsWithRootTag:(ReactTag)tag {
  [_events addObject:[NSString stringWithFormat:@"will:%ld", (long)tag]];
  if (_willMount) _willMount(manager, tag);
}
- (void)mountingManager:(RCTMountingManager *)manager didMountComponentsWithRootTag:(ReactTag)tag {
  [_events addObject:[NSString stringWithFormat:@"did:%ld", (long)tag]];
}
@end

@interface SurfaceMountingTests : XCTestCase
@end

@implementation SurfaceMountingTests
- (void)testNestedSurfaceMountPreservesOuterGuardAndCompletionCallbacks {
  MountingTestSurface outerSurface(11);
  MountingTestSurface holderSurface(21);
  MountingTestSurface unrelatedSurface(31);
  auto outer = outerSurface.coordinator;
  auto holder = holderSurface.coordinator;
  auto unrelated = unrelatedSurface.coordinator;
  RCTMountingManager *manager = [RCTMountingManager new];
  UIView *outerView = [UIView new];
  UIView *holderView = [UIView new];
  UIView *unrelatedView = [UIView new];
  [manager attachSurfaceToView:outerView surfaceId:11];
  [manager attachSurfaceToView:holderView surfaceId:21];
  [manager attachSurfaceToView:unrelatedView surfaceId:31];
  ListMountingTestDelegate *delegate = [ListMountingTestDelegate new];
  manager.delegate = delegate;
  delegate.willMount = ^(RCTMountingManager *mountingManager, ReactTag tag) {
    if (tag != 11) return;
    // Both schedule calls hit RN's real guard. Only our explicit flush may
    // consume holder's coordinator; unrelated must remain untouched.
    [mountingManager scheduleTransaction:holder];
    [mountingManager scheduleTransaction:unrelated];
    margelo::nitro::reactnativelist::flushSurfaceTransaction(mountingManager, *holder, false);
    NSNumber *inFlight = [mountingManager valueForKey:@"transactionInFlight"];
    XCTAssertTrue(inFlight.boolValue);
    XCTAssertFalse(holder->hasPendingTransactions());
    XCTAssertTrue(unrelated->hasPendingTransactions());
    margelo::nitro::reactnativelist::flushSurfaceTransaction(mountingManager, *holder, false);
  };
  [manager scheduleTransaction:outer];
  NSArray *expected = @[@"will:11", @"will:21", @"did:21", @"did:11"];
  XCTAssertEqualObjects(delegate.events, expected);
  NSNumber *inFlight = [manager valueForKey:@"transactionInFlight"];
  XCTAssertFalse(inFlight.boolValue);
  XCTAssertTrue(unrelated->hasPendingTransactions());
}

- (void)testSameSurfaceReentrancyIsRejectedWithoutConsumingItsTransaction {
  MountingTestSurface holderSurface(21);
  auto holder = holderSurface.coordinator;
  RCTMountingManager *manager = [RCTMountingManager new];
  UIView *holderView = [UIView new];
  [manager attachSurfaceToView:holderView surfaceId:21];
  bool rejected = false;
  try {
    margelo::nitro::reactnativelist::flushSurfaceTransaction(manager, *holder, true);
  } catch (const std::runtime_error &error) {
    std::string message = error.what();
    rejected = message.find("Cannot reenter mounting") != std::string::npos;
  }
  XCTAssertTrue(rejected);
  XCTAssertTrue(holder->hasPendingTransactions());
  margelo::nitro::reactnativelist::flushSurfaceTransaction(manager, *holder, false);
  XCTAssertFalse(holder->hasPendingTransactions());
}
@end

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
