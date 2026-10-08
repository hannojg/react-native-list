#import "BorrowedModule.h"
#import <React/RCTInitializing.h>
#import <React/RCTInvalidating.h>
#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>

@implementation BorrowedModule {
  id<RCTBridgeModule, RCTTurboModule> _module;
  std::shared_ptr<facebook::react::NativeMethodCallInvoker> _nativeInvoker;
  BOOL _isSyncModule;
}

+ (NSString *)moduleName { return @"BorrowedModule"; }

- (instancetype)initWithModule:(id<RCTBridgeModule, RCTTurboModule>)module
                  nativeInvoker:(std::shared_ptr<facebook::react::NativeMethodCallInvoker>)nativeInvoker
                   isSyncModule:(BOOL)isSyncModule {
  self = [super init];
  if (self != nil) {
    _module = module;
    _nativeInvoker = std::move(nativeInvoker);
    _isSyncModule = isSyncModule;
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  auto localParams = params;
  localParams.instance = self;
  localParams.nativeMethodCallInvoker = _nativeInvoker;
  localParams.isSyncModule = _isSyncModule;
  return [_module getTurboModule:localParams];
}

- (Class)class { return [_module class]; }

- (BOOL)respondsToSelector:(SEL)selector {
  if (selector == @selector(initialize) || selector == @selector(invalidate) ||
      selector == @selector(installJSIBindingsWithRuntime:) ||
      selector == @selector(installJSIBindingsWithRuntime:callInvoker:)) {
    return NO;
  }
  return [super respondsToSelector:selector] || [_module respondsToSelector:selector];
}

- (NSMethodSignature *)methodSignatureForSelector:(SEL)selector {
  NSMethodSignature *signature = [super methodSignatureForSelector:selector];
  if (signature != nil) {
    return signature;
  }
  return [(NSObject *)_module methodSignatureForSelector:selector];
}

- (void)forwardInvocation:(NSInvocation *)invocation {
  [invocation invokeWithTarget:_module];
}

// Root owns initialization, native events, and teardown. UI only owns its wrapper.
- (void)setEventEmitterCallback:(EventEmitterCallbackWrapper *)callback {}
- (void)initialize {}
- (void)invalidate {}

@end
