#pragma once

#import <React/RCTMountingManager.h>
#include <stdexcept>

// Private, surface-specific entry point. Unlike initiateTransaction:, this does
// not change the manager-wide transaction flags or select another surface.
@interface RCTMountingManager (ListSurfaceMounting)
- (void)performTransaction:(const facebook::react::MountingCoordinator &)mountingCoordinator;
@end

namespace margelo::nitro::reactnativelist {
inline void flushSurfaceTransaction(
    RCTMountingManager *manager,
    const facebook::react::MountingCoordinator &coordinator,
    bool isSurfaceMounting) {
  if (![NSThread isMainThread]) {
    throw std::runtime_error("Holder surface mounting must run on the main thread.");
  }
  if (!coordinator.hasPendingTransactions()) return;
  if (isSurfaceMounting) {
    throw std::runtime_error("Cannot reenter mounting of the same holder surface.");
  }
  if (![manager respondsToSelector:@selector(performTransaction:)]) {
    throw std::runtime_error("Unsupported Fabric mounting internals for holder surfaces.");
  }
  [manager performTransaction:coordinator];
}
}
