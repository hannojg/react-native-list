#import "TurboModuleManager.h"
#import "BorrowedModule.h"
#import <React/RCTConstants.h>

using namespace facebook::react;

namespace {
class ModuleQueueInvoker final : public NativeMethodCallInvoker {
 public:
  explicit ModuleQueueInvoker(dispatch_queue_t queue) : queue_(queue) {}

  void invokeAsync(const std::string &, NativeMethodCallFunc &&function) noexcept override {
    if (queue_ == RCTJSThread) {
      function();
      return;
    }
    auto retainedFunction = std::move(function);
    dispatch_async(queue_, ^{ retainedFunction(); });
  }

  void invokeSync(const std::string &, NativeMethodCallFunc &&function) override { function(); }

 private:
  dispatch_queue_t queue_;
};
}

@implementation TurboModuleManager {
  RCTTurboModuleManager *_rootManager;
}

- (instancetype)initWithRootManager:(RCTTurboModuleManager *)rootManager
                        bridgeProxy:(RCTBridgeProxy *)bridgeProxy
              bridgeModuleDecorator:(RCTBridgeModuleDecorator *)decorator
                           delegate:(id<RCTTurboModuleManagerDelegate>)delegate
                          jsInvoker:(std::shared_ptr<CallInvoker>)invoker {
  self = [super initWithBridgeProxy:bridgeProxy bridgeModuleDecorator:decorator delegate:delegate jsInvoker:invoker];
  if (self != nil) {
    _rootManager = rootManager;
  }
  return self;
}

// RN caches this adapter in the UI manager, never the borrowed native instance.
- (id<RCTBridgeModule>)_createAndSetUpObjCModule:(Class)moduleClass
                                    moduleName:(const char *)name
                                      moduleId:(int32_t)moduleId {
  id<RCTBridgeModule> module = [_rootManager moduleForName:name warnOnLookupFailure:YES];
  if (module == nil) {
    return nil;
  }
  if (![module respondsToSelector:@selector(getTurboModule:)]) {
    @throw [NSException exceptionWithName:@"UnsupportedUiModule"
                                  reason:@"UI runtime borrowing requires a codegen TurboModule."
                                userInfo:nil];
  }
  dispatch_queue_t queue = nil;
  if ([module respondsToSelector:@selector(methodQueue)]) {
    queue = [module methodQueue];
  }
  // RN assigns its shared queue when the module does not supply one.
  if (queue == nil) {
    queue = [_rootManager valueForKey:@"_sharedModuleQueue"];
  }
  if (queue == nil) {
    @throw [NSException exceptionWithName:@"MissingModuleQueue" reason:@"Root native module has no method queue." userInfo:nil];
  }
  auto nativeInvoker = std::make_shared<ModuleQueueInvoker>(queue);
  return [[BorrowedModule alloc] initWithModule:(id<RCTBridgeModule, RCTTurboModule>)module
                                  nativeInvoker:std::move(nativeInvoker)
                                   isSyncModule:queue == RCTJSThread];
}

@end
