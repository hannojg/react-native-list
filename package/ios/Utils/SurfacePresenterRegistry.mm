#import "SurfacePresenterRegistry.h"

#import <React/RCTSurfacePresenterStub.h>
#import <ReactCommon/RCTTurboModule.h>

#include <memory>

static __weak RCTBridge *sCurrentReactBridge = nil;
static __weak RCTModuleRegistry *sCurrentModuleRegistry = nil;
static __weak id<RCTSurfacePresenterStub> sCurrentSurfacePresenter = nil;

@interface SurfacePresenterRegistry () <RCTTurboModule>
@end

@implementation SurfacePresenterRegistry

@synthesize bridge = _bridge;
@synthesize moduleRegistry = _moduleRegistry;

RCT_EXPORT_MODULE(HybridUiListSurfacePresenterRegistry);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

+ (nullable RCTModuleRegistry *)currentModuleRegistry
{
  return sCurrentModuleRegistry;
}

+ (nullable id)currentSurfacePresenter
{
  id<RCTSurfacePresenterStub> surfacePresenter = sCurrentSurfacePresenter;
  if (surfacePresenter != nil) {
    return surfacePresenter;
  }

  RCTBridge *bridge = sCurrentReactBridge;
  return [bridge surfacePresenter];
}

- (void)setBridge:(RCTBridge *)bridge
{
  _bridge = bridge;
  sCurrentReactBridge = bridge;
}

- (void)setModuleRegistry:(RCTModuleRegistry *)moduleRegistry
{
  _moduleRegistry = moduleRegistry;
  sCurrentModuleRegistry = moduleRegistry;
}

- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)surfacePresenter
{
  sCurrentSurfacePresenter = surfacePresenter;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::ObjCTurboModule>(params);
}

@end
