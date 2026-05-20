//
// Created by Hanno Gödecke on 25.01.26.
//

#pragma once

#include "HybridUiManagerHelperSpec.hpp"
#include "WorkletsUiCallInvoker.hpp"

#include <react/renderer/core/EventListener.h>
#include <react/renderer/scheduler/Scheduler.h>
#include <mutex>
#include <unordered_set>

namespace margelo::nitro::reactnativelist
{

    class HybridUiManagerHelper : public HybridUiManagerHelperSpec
    {
    public:
        HybridUiManagerHelper() : HybridObject(TAG) {}

    public:
        void renderSync(
            std::shared_ptr<facebook::react::UIManagerBinding> nativeFabricUIManager,
            double surfaceId) override;
        void registerManagedSurface(double surfaceId) override;
        void unregisterManagedSurface(double surfaceId) override;
        static std::shared_ptr<react::EventListener> createEventInterceptor(std::shared_ptr<react::CallInvoker> uiCallInvoker);
        static void setupEventInterceptor(const std::shared_ptr<facebook::react::Scheduler> &scheduler, std::shared_ptr<react::CallInvoker> uiCallInvoker);

    private:
        static bool isManagedSurface(react::SurfaceId surfaceId);
        static std::mutex managedSurfaceIdsMutex_;
        static std::unordered_set<react::SurfaceId> managedSurfaceIds_;
    };

}
