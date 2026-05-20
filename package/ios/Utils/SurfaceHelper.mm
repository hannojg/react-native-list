//
//  SurfaceHelper.m
//  ReactNativeList
//
//  Created by Hanno Gödecke on 15.02.26.
//

#import "SurfaceHelper.h"
#import "SurfacePresenterRegistry.h"
#import "ErrorUtils.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTBridge.h>
#import <React/RCTFabricSurface.h>
#import <React/RCTSurfacePresenterStub.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTSurfaceProtocol.h>

#import <React/RCTComponentViewProtocol.h>
#import <React/RCTComponentViewRegistry.h>
#import <React/RCTMountingManager.h>

using namespace facebook;
using namespace facebook::react;

namespace {
    static NSMutableDictionary<NSNumber *, id<RCTSurfaceProtocol>> *externalSurfaces()
    {
      static NSMutableDictionary<NSNumber *, id<RCTSurfaceProtocol>> *surfaces = nil;
      static dispatch_once_t onceToken;
      dispatch_once(&onceToken, ^{
        surfaces = [NSMutableDictionary new];
      });
      return surfaces;
    }

    inline RCTSurfacePresenter* _Nullable resolveSurfacePresenter(RCTBridge *bridge)
    {
      id<RCTSurfacePresenterStub> surfacePresenter =
          (id<RCTSurfacePresenterStub>)[SurfacePresenterRegistry currentSurfacePresenter];
      if (surfacePresenter != nil) {
        return surfacePresenter;
      }

      return [bridge surfacePresenter];
    }
} // namespace

@implementation SurfaceHelper

+ (nullable NSNumber *)createExternalSurface:(NSError *__autoreleasing _Nullable * _Nullable)error
{
  @try {
    if (![NSThread isMainThread]) {
      assignError(error, @"createExternalSurface() must run on the main thread.");
      return nil;
    }

    RCTBridge *bridge = [RCTBridge currentBridge];
    if (bridge == nil) {
      assignError(error, @"Could not access RCTBridge.currentBridge.");
      return nil;
    }

    RCTSurfacePresenter *surfacePresenter = resolveSurfacePresenter(bridge);
    if (surfacePresenter == nil) {
      assignError(error, @"Could not access an active RCTSurfacePresenter.");
      return nil;
    }

    id<RCTSurfaceProtocol> surface = [surfacePresenter createFabricSurfaceForModuleName:@"" initialProperties:@{}];
    if (surface == nil) {
      assignError(error, @"Failed to create Fabric surface.");
      return nil;
    }

    if (![surface isKindOfClass:[RCTFabricSurface class]]) {
      assignError(error, @"Expected a RCTFabricSurface instance.");
      return nil;
    }

    [surface start];
    NSNumber *surfaceId = @(surface.rootTag);
    externalSurfaces()[surfaceId] = surface;
    NSLog(@"Created external surface %@", surfaceId);
    return surfaceId;
  } @catch (NSException *exception) {
    assignError(error, [NSString stringWithFormat:@"Surface creation failed with NSException: %@", exception.reason]);
    return nil;
  }
}

+ (BOOL)releaseExternalSurface:(ReactTag)surfaceId error:(NSError * _Nullable __autoreleasing * _Nullable)error {
    @try {
        if (![NSThread isMainThread]) {
          assignError(error, @"releaseExternalSurface() must run on the main thread.");
          return NO;
        }

        NSNumber *surfaceKey = @(surfaceId);
        id<RCTSurfaceProtocol> surface = externalSurfaces()[surfaceKey];
        if (surface == nil) {
            return YES;
        }

        [surface stop];
        [externalSurfaces() removeObjectForKey:surfaceKey];
        return YES;
    } @catch (NSException *exception) {
        assignError(error, [NSString stringWithFormat:@"Surface release failed with NSException: %@", exception.reason]);
        return NO;
    }
}

+ (nullable UIView *)getViewByTag:(ReactTag)tag error:(NSError * _Nullable __autoreleasing * _Nullable)error {
    if (![NSThread isMainThread]) {
      assignError(error, @"getViewByTag() must run on the main thread.");
      return nil;
    }

    RCTBridge *bridge = [RCTBridge currentBridge];
    if (bridge == nil) {
      assignError(error, @"Could not access RCTBridge.currentBridge.");
      return nil;
    }

    RCTSurfacePresenter *surfacePresenter = resolveSurfacePresenter(bridge);
    if (surfacePresenter == nil) {
      assignError(error, @"Could not access an active RCTSurfacePresenter.");
      return nil;
    }

    RCTComponentViewRegistry *componentViewRegistry = surfacePresenter.mountingManager.componentViewRegistry;
    Tag intTag = static_cast<Tag>(tag);
    UIView<RCTComponentViewProtocol> *componentView = [componentViewRegistry findComponentViewWithTag:intTag];
    if (componentView == nil) {
        assignError(error, [NSString stringWithFormat:@"Could not resolve view with tag %d on surface %@", intTag, @-1]);
        return nil;
    }
    
    return componentView;
}

@end
