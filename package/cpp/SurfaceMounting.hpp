#pragma once

#include <react/renderer/core/ReactPrimitives.h>

namespace margelo::nitro::reactnativelist {
// After the synchronous shadow-tree commit, make this holder's native mutations
// visible for immediate view lookup/measurement. Must run on the UI thread for an
// attached, library-owned surface. Platform adapters leave unrelated surfaces and
// RN's global mounting guards untouched; this is not a general recursive flush.
void flushSurfaceMounting(facebook::react::SurfaceId surfaceId);
}
