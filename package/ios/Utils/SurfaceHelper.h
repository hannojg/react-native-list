//
//  SurfaceHelper.h
//  ReactNativeList
//
//  Created by Hanno Gödecke on 15.02.26.
//

#import <Foundation/Foundation.h>
#import <React/RCTPrimitives.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface SurfaceHelper : NSObject
+ (nullable NSNumber *)createExternalSurface:(NSError * _Nullable * _Nullable)error;
+ (BOOL)releaseExternalSurface:(ReactTag)surfaceId error:(NSError * _Nullable * _Nullable)error;
+ (nullable UIView *)getViewByTag:(ReactTag)tag error:(NSError * _Nullable * _Nullable)error;
@end

NS_ASSUME_NONNULL_END
