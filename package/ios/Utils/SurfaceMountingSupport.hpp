#pragma once

#import <React/RCTMountingManager.h>
#include <stdexcept>

// A synchronous holder commit can occur while Fabric is mounting a different surface.
// RN's public scheduling path then defers the holder because _transactionInFlight is
// manager-wide, leaving its native views unavailable for immediate lookup/measurement.
//
// performTransaction: pulls only the supplied coordinator's transaction and runs RN's
// normal native mutations, observer hooks, and presenter delegate callbacks. Unlike
// initiateTransaction:, it does not modify the manager-wide transaction flags. Calling
// it here permits a distinct holder surface to mount inside the app surface's mount
// without flushing unrelated surfaces or clearing the outer transaction's guard.
//
// This is a private RN entry point validated with 0.86.2, not a stable embedding API.
// The caller must provide an attached, library-owned surface and its owning manager,
// and track active mounts through presenter callbacks to reject same-surface reentry.
// RN upgrades require the native tests and app smoke checks in native-tests/README.md.
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
