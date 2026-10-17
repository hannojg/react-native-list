#pragma once

#include <react/renderer/core/ReactPrimitives.h>

namespace margelo::nitro::reactnativelist {
// Platform adapters flush only this owned surface after completeSurface returns.
void flushSurfaceMounting(facebook::react::SurfaceId surfaceId);
}
