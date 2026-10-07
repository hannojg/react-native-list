#import "TurboModuleInstaller.h"
#import "SurfacePresenterRegistry.h"
#import "WorkletsUiCallInvoker.hpp"
#import "ErrorUtils.h"
#import "HybridUiManagerHelper.hpp"

#import <React/RCTBridgeModule.h>
#import <React/RCTBridgeModuleDecorator.h>
#import <React/RCTBridgeProxy.h>
#import <React/RCTScheduler.h>
#import <React/RCTSurfacePresenter.h>
#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/RCTTurboModuleManager.h>
#import <worklets/apple/AssertJavaScriptQueue.h>
#import <worklets/apple/WorkletsModule.h>
#import <NitroModules/NitroLogger.hpp>

#include <jsi/jsi.h>
#include <react/utils/jsi-utils.h>

using namespace facebook;
using namespace facebook::react;
using namespace worklets;

namespace {

static RCTTurboModuleManager *sUiTurboModuleManager = nil;
static uint64_t sInstalledRuntimeId = 0;
static BOOL sHasInstalledRuntime = NO;
static std::shared_ptr<facebook::react::CallInvoker> uiCallInvoker = nullptr;

} // namespace

@interface HybridWorkletsModuleProxyHolderBox ()

- (instancetype)initWithWorkletsModuleProxy:(std::shared_ptr<WorkletsModuleProxy>)workletsModuleProxy
                              moduleRegistry:(RCTModuleRegistry *)moduleRegistry;
- (std::shared_ptr<WorkletsModuleProxy>)workletsModuleProxy;
- (RCTModuleRegistry *)moduleRegistry;

@end

@implementation HybridWorkletsModuleProxyHolderBox {
  std::shared_ptr<WorkletsModuleProxy> _workletsModuleProxy;
  RCTModuleRegistry *_moduleRegistry;
}

- (instancetype)initWithWorkletsModuleProxy:(std::shared_ptr<WorkletsModuleProxy>)workletsModuleProxy
                              moduleRegistry:(RCTModuleRegistry *)moduleRegistry
{
  self = [super init];
  if (self != nil) {
    _workletsModuleProxy = std::move(workletsModuleProxy);
    _moduleRegistry = moduleRegistry;
  }
  return self;
}

- (std::shared_ptr<WorkletsModuleProxy>)workletsModuleProxy
{
  return _workletsModuleProxy;
}

- (RCTModuleRegistry *)moduleRegistry
{
  return _moduleRegistry;
}

@end

@implementation TurboModuleInstaller

+ (nullable HybridWorkletsModuleProxyHolderBox *)createWorkletsModuleProxyHolder:
    (NSError *__autoreleasing _Nullable * _Nullable)error
{
  @try {
    if (!IsJavaScriptQueue()) {
      assignError(error, @"iosGetWorkletsModule() must run on the JavaScript queue.");
      return nil;
    }

    RCTModuleRegistry *moduleRegistry = [SurfacePresenterRegistry currentModuleRegistry];
    if (moduleRegistry == nil) {
      assignError(error, @"RCTModuleRegistry was not injected into HybridUiListSurfacePresenterRegistry.");
      return nil;
    }

    if ([SurfacePresenterRegistry currentSurfacePresenter] == nil) {
      assignError(error, @"SurfacePresenter was not injected into HybridUiListSurfacePresenterRegistry.");
      return nil;
    }

    WorkletsModule *workletsModule = [moduleRegistry moduleForClass:WorkletsModule.class];
    if (workletsModule == nil) {
      assignError(error, @"WorkletsModule is not available from RCTModuleRegistry.");
      return nil;
    }

    std::shared_ptr<WorkletsModuleProxy> workletsModuleProxy = [workletsModule getWorkletsModuleProxy];
    if (workletsModuleProxy == nullptr) {
      assignError(error, @"Could not access WorkletsModuleProxy.");
      return nil;
    }

    return [[HybridWorkletsModuleProxyHolderBox alloc] initWithWorkletsModuleProxy:std::move(workletsModuleProxy)
                                                                  moduleRegistry:moduleRegistry];
  } @catch (NSException *exception) {
    assignError(error, [NSString stringWithFormat:@"Failed to create WorkletsModuleProxy holder: %@", exception.reason]);
    return nil;
  }
}

+ (BOOL)installNativeModuleProxyInUIRuntimeWithHolder:(HybridWorkletsModuleProxyHolderBox *)holder
                                                 error:(NSError *__autoreleasing _Nullable * _Nullable)error
{
  @try {
      margelo::nitro::Logger::log(margelo::nitro::LogLevel::Debug, "TurboModuleInstaller", "installNativeModuleProxyInUIRuntime()");
    if (holder == nil) {
      assignError(error, @"Expected non-null IOSWorkletsModuleProxyHolder.");
      return NO;
    }

    std::shared_ptr<WorkletsModuleProxy> workletsModuleProxy = [holder workletsModuleProxy];
    if (workletsModuleProxy == nullptr) {
      assignError(error, @"IOSWorkletsModuleProxyHolder does not contain a WorkletsModuleProxy.");
      return NO;
    }

    std::shared_ptr<UIScheduler> uiScheduler = workletsModuleProxy->getUIScheduler();
    if (uiScheduler == nullptr) {
      assignError(error, @"Could not access UIScheduler from WorkletsModuleProxy.");
      return NO;
    }

    std::shared_ptr<WorkletRuntime> uiWorkletRuntime = workletsModuleProxy->getUIWorkletRuntime();
    if (uiWorkletRuntime == nullptr) {
      assignError(error, @"Could not access UIWorkletRuntime from WorkletsModuleProxy.");
      return NO;
    }

    uint64_t runtimeId = uiWorkletRuntime->getRuntimeId();
    if (sHasInstalledRuntime && sInstalledRuntimeId == runtimeId) {
      return YES;
    }

    bool hasNativeModuleProxy = false;
    uiWorkletRuntime->runSync([&](jsi::Runtime &runtime) {
      // We first have to set this to be bridgeless too
      // TODO: upstream this to worklets to set this for their runtime if the JS runtime is bridgeless
      // Note: do i want to make this xplat? have the same code dupe in android
      if (!runtime.global().hasProperty(runtime, "RN$Bridgeless")) {
        react::defineReadOnlyGlobal(runtime, "RN$Bridgeless", jsi::Value(true));
      }
      
      jsi::Value proxy = runtime.global().getProperty(runtime, "nativeModuleProxy");
      hasNativeModuleProxy = !proxy.isUndefined() && !proxy.isNull();
    });
    if (hasNativeModuleProxy) {
      sHasInstalledRuntime = YES;
      sInstalledRuntimeId = runtimeId;
      return YES;
    }

    RCTModuleRegistry *moduleRegistry = [holder moduleRegistry];
    if (moduleRegistry == nil) {
      assignError(error, @"IOSWorkletsModuleProxyHolder does not contain an RCTModuleRegistry.");
      return NO;
    }

    id turboModuleRegistry = [moduleRegistry valueForKey:@"_turboModuleRegistry"];
    if (![turboModuleRegistry isKindOfClass:[RCTTurboModuleManager class]]) {
      assignError(error, @"moduleRegistry does not contain an active RCTTurboModuleManager.");
      return NO;
    }

    RCTTurboModuleManager *rootTurboModuleManager = (RCTTurboModuleManager *)turboModuleRegistry;
    id<RCTTurboModuleManagerDelegate> delegate = [rootTurboModuleManager valueForKey:@"_delegate"];
    if (delegate == nil) {
      assignError(error, @"Could not access RCTTurboModuleManager delegate.");
      return NO;
    }

    RCTBridgeProxy *bridgeProxy = [rootTurboModuleManager valueForKey:@"_bridgeProxy"];
    if (bridgeProxy == nil) {
      assignError(error, @"Could not access RCTBridgeProxy.");
      return NO;
    }

    RCTBridgeModuleDecorator *bridgeModuleDecorator = [rootTurboModuleManager valueForKey:@"_bridgeModuleDecorator"];
    if (bridgeModuleDecorator == nil) {
      assignError(error, @"Could not access RCTBridgeModuleDecorator.");
      return NO;
    }

    uiCallInvoker = std::make_shared<margelo::nitro::reactnativelist::WorkletsUiCallInvoker>(uiScheduler, uiWorkletRuntime, []() {
        return [NSThread isMainThread];
    });

    RCTTurboModuleManager *uiTurboModuleManager = [[RCTTurboModuleManager alloc] initWithBridgeProxy:bridgeProxy
                                                           bridgeModuleDecorator:bridgeModuleDecorator
                                                                        delegate:delegate
                                                                       jsInvoker:uiCallInvoker];
    if (uiTurboModuleManager == nil) {
      assignError(error, @"Failed to create a UI-runtime RCTTurboModuleManager.");
      return NO;
    }

      margelo::nitro::Logger::log(margelo::nitro::LogLevel::Debug, "TurboModuleInstaller", "schedule install JSI bindings!");
    uiWorkletRuntime->runSync([uiTurboModuleManager](jsi::Runtime &runtime) {
      [uiTurboModuleManager installJSBindings:runtime];
        margelo::nitro::Logger::log(margelo::nitro::LogLevel::Debug, "TurboModuleInstaller", "installed JSI bindings!");
    });

    sUiTurboModuleManager = uiTurboModuleManager;
    sHasInstalledRuntime = YES;
    sInstalledRuntimeId = runtimeId;
    return YES;
  } @catch (NSException *exception) {
    assignError(error, [NSString stringWithFormat:@"TurboModule install failed with NSException: %@", exception.reason]);
    return NO;
  }
}

+ (BOOL)setupEventInterceptor:(NSError *__autoreleasing _Nullable * _Nullable)error {
  @try {
    if (uiCallInvoker == nullptr) {
      assignError(error, @"UI CallInvoker must be initialized before setting up event interceptor.");
      return NO;
    }

    id surfacePresenterObj = [SurfacePresenterRegistry currentSurfacePresenter];
    if (surfacePresenterObj == nil) {
      assignError(error, @"SurfacePresenter from SurfacePresenterRegistry was null!");
      return NO;
    }

    if (![surfacePresenterObj isKindOfClass:[RCTSurfacePresenter class]]) {
      assignError(error, @"SurfacePresenterRegistry did not return an RCTSurfacePresenter instance.");
      return NO;
    }

    RCTSurfacePresenter *surfacePresenter = (RCTSurfacePresenter *)surfacePresenterObj;
    RCTScheduler *scheduler = surfacePresenter.scheduler;
    if (scheduler == nil) {
      assignError(error, @"Could not access an active RCTScheduler from the current RCTSurfacePresenter.");
      return NO;
    }

    std::shared_ptr<EventListener> eventInterceptor =
        margelo::nitro::reactnativelist::HybridUiManagerHelper::createEventInterceptor(uiCallInvoker);
    [scheduler addEventListener:eventInterceptor];

    return YES;
  } @catch (NSException *exception) {
    assignError(error, [NSString stringWithFormat:@"Event interceptor setup failed with NSException: %@", exception.reason]);
    return NO;
  }
}

@end
