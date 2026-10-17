//
//  SurfaceHelper.m
//  ReactNativeList
//
//  Created by Hanno Gödecke on 15.02.26.
//

#import "SurfaceHelper.h"
#import "SurfacePresenterRegistry.h"
#import "ErrorUtils.h"
#include "../../cpp/SurfaceMounting.hpp"
#include "SurfaceMountingSupport.hpp"

#import <React/RCTFabricSurface.h>
#import <React/RCTSurfacePresenterStub.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTSurfaceProtocol.h>
#import <React/RCTSurfaceView.h>

#import <React/RCTComponentViewProtocol.h>
#import <React/RCTComponentViewRegistry.h>
#import <React/RCTMountingManager.h>

using namespace facebook;
using namespace facebook::react;

@interface ListSurfaceMountingObserver : NSObject <RCTSurfacePresenterObserver>
@property (nonatomic, strong) NSMutableSet<NSNumber *> *mountingSurfaceIds;
@property (nonatomic, weak) RCTSurfacePresenter *presenter;
@end

@implementation ListSurfaceMountingObserver
- (instancetype)init {
  if (self = [super init]) {
    _mountingSurfaceIds = [NSMutableSet new];
  }
  return self;
}
- (void)willMountComponentsWithRootTag:(ReactTag)rootTag {
  [_mountingSurfaceIds addObject:@(rootTag)];
}
- (void)didMountComponentsWithRootTag:(ReactTag)rootTag {
  [_mountingSurfaceIds removeObject:@(rootTag)];
}
@end

namespace {
    ListSurfaceMountingObserver *observeSurfaceMounting(RCTSurfacePresenter *presenter) {
      static NSMapTable<RCTSurfacePresenter *, ListSurfaceMountingObserver *> *observers =
          [NSMapTable weakToStrongObjectsMapTable];
      ListSurfaceMountingObserver *observer = [observers objectForKey:presenter];
      if (observer == nil) {
        observer = [ListSurfaceMountingObserver new];
        observer.presenter = presenter;
        [presenter addObserver:observer];
        [observers setObject:observer forKey:presenter];
      }
      return observer;
    }

    NSMutableDictionary<NSNumber *, ListSurfaceMountingObserver *> *surfaceMountingObservers() {
      static NSMutableDictionary<NSNumber *, ListSurfaceMountingObserver *> *observers =
          [NSMutableDictionary new];
      return observers;
    }

    static NSMutableDictionary<NSNumber *, id<RCTSurfaceProtocol>> *externalSurfaces()
    {
      static NSMutableDictionary<NSNumber *, id<RCTSurfaceProtocol>> *surfaces = nil;
      static dispatch_once_t onceToken;
      dispatch_once(&onceToken, ^{
        surfaces = [NSMutableDictionary new];
      });
      return surfaces;
    }

    inline RCTSurfacePresenter* _Nullable resolveSurfacePresenter()
    {
      id<RCTSurfacePresenterStub> surfacePresenter =
          (id<RCTSurfacePresenterStub>)[SurfacePresenterRegistry currentSurfacePresenter];
      if (surfacePresenter != nil) {
        return surfacePresenter;
      }

      return nil;
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

    RCTSurfacePresenter *surfacePresenter = resolveSurfacePresenter();
    if (surfacePresenter == nil) {
      assignError(error, @"Could not access an active RCTSurfacePresenter.");
      return nil;
    }
    ListSurfaceMountingObserver *observer = observeSurfaceMounting(surfacePresenter);

    id<RCTSurfaceProtocol> surface = [surfacePresenter createFabricSurfaceForModuleName:@"" initialProperties:@{}];
    if (surface == nil) {
      assignError(error, @"Failed to create Fabric surface.");
      return nil;
    }

    if (![surface isKindOfClass:[RCTFabricSurface class]]) {
      assignError(error, @"Expected a RCTFabricSurface instance.");
      return nil;
    }

    // These are empty, library-owned roots, not AppRegistry applications. Start the
    // registered handler on the main thread so the very first row can mount immediately.
    RCTFabricSurface *fabricSurface = (RCTFabricSurface *)surface;
    const auto &handler = fabricSurface.surfaceHandler;
    if (handler.getStatus() != SurfaceHandler::Status::Registered) {
      assignError(error, @"Holder surface has no active Fabric scheduler.");
      return nil;
    }
    [surfacePresenter.mountingManager attachSurfaceToView:fabricSurface.view surfaceId:handler.getSurfaceId()];
    handler.start();
    [surfacePresenter setupAnimationDriverWithSurfaceHandler:handler];
    NSNumber *surfaceId = @(surface.rootTag);
    externalSurfaces()[surfaceId] = surface;
    surfaceMountingObservers()[surfaceId] = observer;
    return surfaceId;
  } @catch (NSException *exception) {
    assignError(error, [NSString stringWithFormat:@"Surface creation failed with NSException: %@", exception.reason]);
    return nil;
  }
}

+ (nullable UIView *)getSurfaceView:(ReactTag)surfaceId error:(NSError *__autoreleasing _Nullable * _Nullable)error {
    if (![NSThread isMainThread]) {
        assignError(error, @"getSurfaceView() must run on the main thread.");
        return nil;
    }
    id<RCTSurfaceProtocol> surface = externalSurfaces()[@(surfaceId)];
    if (surface == nil) {
        assignError(error, @"Holder surface does not exist.");
        return nil;
    }
    return surface.view;
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
        [surfaceMountingObservers() removeObjectForKey:surfaceKey];
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

    RCTSurfacePresenter *surfacePresenter = resolveSurfacePresenter();
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

namespace margelo::nitro::reactnativelist {
void flushSurfaceMounting(SurfaceId surfaceId) {
  if (![NSThread isMainThread]) {
    throw std::runtime_error("Holder surface mounting must run on the main thread.");
  }
  RCTFabricSurface *surface = (RCTFabricSurface *)externalSurfaces()[@(surfaceId)];
  if (surface == nil) {
    throw std::runtime_error("Cannot flush an unknown holder surface.");
  }
  const auto &handler = surface.surfaceHandler;
  auto coordinator = handler.getMountingCoordinator();
  if (!coordinator) {
    throw std::runtime_error("Holder surface has no mounting coordinator.");
  }
  ListSurfaceMountingObserver *observer = surfaceMountingObservers()[@(surfaceId)];
  RCTSurfacePresenter *presenter = observer.presenter;
  RCTMountingManager *manager = presenter.mountingManager;
  BOOL isMounting = [observer.mountingSurfaceIds containsObject:@(surfaceId)];
  flushSurfaceTransaction(manager, *coordinator, isMounting);
}
}
