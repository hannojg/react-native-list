#import <Foundation/Foundation.h>

#import <React/RCTBridgeModule.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Receives the per-instance React dependencies used by the UI-runtime installer.
 * React Native injects these dependencies during module instantiation.
 */
@interface SurfacePresenterRegistry : NSObject <RCTBridgeModule>

+ (nullable RCTModuleRegistry *)currentModuleRegistry;
+ (nullable id)currentSurfacePresenter;

@end

NS_ASSUME_NONNULL_END
