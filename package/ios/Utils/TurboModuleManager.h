#import <ReactCommon/RCTTurboModuleManager.h>

// Creates runtime-local wrappers around root-owned native modules. Borrowing adapters prevent
// this second manager from initializing or invalidating the shared native instances.
@interface TurboModuleManager : RCTTurboModuleManager

- (instancetype)initWithRootManager:(RCTTurboModuleManager *)rootManager
                        bridgeProxy:(RCTBridgeProxy *)bridgeProxy
              bridgeModuleDecorator:(RCTBridgeModuleDecorator *)decorator
                           delegate:(id<RCTTurboModuleManagerDelegate>)delegate
                          jsInvoker:(std::shared_ptr<facebook::react::CallInvoker>)invoker;

@end
