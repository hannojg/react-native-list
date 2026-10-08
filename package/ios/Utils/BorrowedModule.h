#import <ReactCommon/RCTTurboModule.h>

// Forwards native methods to the root-owned instance while keeping initialization, event
// callbacks, JSI binding installation, and teardown under the root manager's ownership.
@interface BorrowedModule : NSObject <RCTBridgeModule, RCTTurboModule>

- (instancetype)initWithModule:(id<RCTBridgeModule, RCTTurboModule>)module
                  nativeInvoker:(std::shared_ptr<facebook::react::NativeMethodCallInvoker>)nativeInvoker
                   isSyncModule:(BOOL)isSyncModule;

@end
