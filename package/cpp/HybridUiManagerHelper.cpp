//
// Created by Hanno Gödecke on 25.01.26.
//

#include "HybridUiManagerHelper.hpp"
#include <react/renderer/core/EventTarget.h>
#include <react/renderer/uimanager/UIManagerBinding.h>

namespace margelo::nitro::reactnativelist
{
    using namespace facebook;

    static std::shared_ptr<react::EventListener> eventInterceptor_ = nullptr;
    std::mutex HybridUiManagerHelper::managedSurfaceIdsMutex_;
    std::unordered_set<react::SurfaceId> HybridUiManagerHelper::managedSurfaceIds_;

    void
    HybridUiManagerHelper::renderSync(
        std::shared_ptr<facebook::react::UIManagerBinding> binding,
        double surfaceId)
    {
        if (!binding)
        {
            throw std::runtime_error(
                "HybridUiManagerHelper::renderSync: UIManagerBinding is not installed in the runtime.");
        }
        react::UIManager &uiManager = binding->getUIManager();
        react::SurfaceId targetSurfaceId = static_cast<react::SurfaceId>(surfaceId);
        uiManager.getShadowTreeRegistry().visit(targetSurfaceId, [targetSurfaceId](const react::ShadowTree &shadowTree)
                                                {
            // This will immediately cause all queued mounting transactions to be processed
            Logger::log(LogLevel::Debug, "HybridUiManagerHelper", "Notifying delegates of updates for surfaceId %d", targetSurfaceId);
            shadowTree.notifyDelegatesOfUpdates(); });
    }

    void HybridUiManagerHelper::registerManagedSurface(double surfaceId)
    {
        std::lock_guard<std::mutex> lock(managedSurfaceIdsMutex_);
        managedSurfaceIds_.insert(static_cast<react::SurfaceId>(surfaceId));
    }

    void HybridUiManagerHelper::unregisterManagedSurface(double surfaceId)
    {
        std::lock_guard<std::mutex> lock(managedSurfaceIdsMutex_);
        managedSurfaceIds_.erase(static_cast<react::SurfaceId>(surfaceId));
    }

    bool HybridUiManagerHelper::isManagedSurface(react::SurfaceId surfaceId)
    {
        std::lock_guard<std::mutex> lock(managedSurfaceIdsMutex_);
        return managedSurfaceIds_.find(surfaceId) != managedSurfaceIds_.end();
    }

    std::shared_ptr<react::EventListener> HybridUiManagerHelper::createEventInterceptor(
        std::shared_ptr<react::CallInvoker> uiCallInvoker)
    {
        if (!uiCallInvoker)
        {
            throw std::runtime_error(
                "HybridUiManagerHelper::createEventInterceptor: UI CallInvoker is not available.");
        }

        eventInterceptor_ = std::make_shared<react::EventListener>(
            [uiCallInvoker](const react::RawEvent &event)
            {
                if (event.eventTarget == nullptr)
                {
                    Logger::log(LogLevel::Error, "HybridUiManagerHelper", "[HannoDebug] Event target is null, skipping event handling");
                    return false;
                }

                // Intercept all events and trigger a transaction to ensure the UI thread is processing updates.
                auto eventSurfaceId = event.eventTarget->getSurfaceId();
                if (isManagedSurface(eventSurfaceId))
                {
                    // This is an event from a view we manage, special handling needed
                    Logger::log(LogLevel::Debug, "HybridUiManagerHelper", "[HannoDebug] Intercepted event of type %s from managed surface %d!", event.type.c_str(), eventSurfaceId);
                    // Expect function handler to be installed on global
                    uiCallInvoker->invokeAsync([event_ = event](jsi::Runtime &runtime)
                                               {
                            auto global = runtime.global();
                            auto handlerValue = global.getProperty(runtime, "handleEvent");
                            if (handlerValue.isObject() &&
                                handlerValue.asObject(runtime).isFunction(runtime)) {
                                // TODO: it would be nice to cache this JSI function!
                                auto handlerFunc = handlerValue.asObject(runtime).asFunction(
                                        runtime);

                                // from: UIManagerBinding.cpp#63
                                if (event_.eventPayload->getType() ==
                                    react::EventPayloadType::PointerEvent) {
                                    throw std::runtime_error(
                                            "PointerEvent payload handling is not implemented yet");
                                } else {
                                    auto payload = event_.eventPayload->asJSIValue(runtime);
                                    if (payload.isNull()) {
                                        Logger::log(LogLevel::Error, "HybridUiManagerHelper", "[HannoDebug] Event payload is null, skipping event handling");
                                        return;
                                    }

                                    auto instanceHandle =
                                            event_.eventTarget == nullptr ? jsi::Value::null()
                                                                          : [&]() {
                                                event_.eventTarget->retain(runtime);
                                                auto instanceHandle = event_.eventTarget->getInstanceHandle(
                                                        runtime);
                                                if (instanceHandle.isUndefined()) {
                                                    return jsi::Value::null();
                                                }

                                                // Mixing `target` into `payload`.
                                                if (!payload.isObject()) {
                                                    Logger::log(LogLevel::Error, "HybridUiManagerHelper", "[HannoDebug] Event payload is not an object, skipping event handling for event target with tag %d", event_.eventTarget->getTag());
                                                }
                                                react_native_assert(payload.isObject());
                                                payload.asObject(runtime).setProperty(
                                                        runtime, "target",
                                                        event_.eventTarget->getTag());
                                                return instanceHandle;
                                            }();

                                    if (instanceHandle.isNull()) {
                                        Logger::log(LogLevel::Error, "HybridUiManagerHelper", "[HannoDebug] Event target instance handle is null, skipping event handling for event of type %s", event_.type.c_str());
                                    }


                                    handlerFunc.call(
                                            runtime,
                                            std::move(instanceHandle),
                                            jsi::String::createFromUtf8(runtime, event_.type),
                                            std::move(payload)
                                    );
                                    Logger::log(LogLevel::Debug, "HybridUiManagerHelper", "[HannoDebug] Called JS event handler successfully for event of type %s", event_.type.c_str());
                                    event_.eventTarget->release(runtime);
                                }
                            } else {
                                throw std::runtime_error(
                                        "handleEvent function is not defined on the global object");
                            } });

                    return true;
                }

                return false;
            });

        return eventInterceptor_;
    }

    void HybridUiManagerHelper::setupEventInterceptor(
        const std::shared_ptr<facebook::react::Scheduler> &scheduler,
        std::shared_ptr<react::CallInvoker> uiCallInvoker)
    {
        if (!scheduler)
        {
            throw std::runtime_error(
                "HybridUiManagerHelper::setupEventInterceptor: Scheduler is not installed in the runtime.");
        }

        std::shared_ptr<react::EventListener> eventInterceptor = createEventInterceptor(std::move(uiCallInvoker));

        // TODO: unregister.
        scheduler->addEventListener(eventInterceptor);
    }
}
