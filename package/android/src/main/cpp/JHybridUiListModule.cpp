#include "JHybridUiListModule.h"
#include "WorkletsUiCallInvoker.hpp"
#include "HybridUiManagerHelper.hpp"

#include <NitroModules/CallInvokerDispatcher.hpp>
#include <NitroModules/InstallNitro.hpp>
#include <react/utils/jsi-utils.h>
#include <react/fabric/FabricUIManagerBinding.h>
#include <worklets/android/WorkletsModule.h>

namespace margelo::nitro::reactnativelist
{
    static bool isOnAndroidUiThread()
    {
        return getpid() == gettid();
    }

    std::shared_ptr<react::CallInvoker> JHybridUiListModule::uiCallInvoker_ = nullptr;

    void JHybridUiListModule::registerNatives()
    {
        javaClassStatic()->registerNatives({
            makeNativeMethod("prepareUiRuntime",
                             prepareUiRuntime),
            makeNativeMethod("getUiCallInvokerHolder",
                             getUiCallInvokerHolder),
            makeNativeMethod("getUiRuntimeExecutor",
                             getUiRuntimeExecutor),
            makeNativeMethod("setupEventInterceptor",
                             setupEventInterceptor),
        });
    }

    std::shared_ptr<react::CallInvoker> JHybridUiListModule::getOrInitCallInvoker(
        jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule)
    {
        if (uiCallInvoker_)
        {
            return uiCallInvoker_;
        }

        if (!workletsModule)
        {
            throw std::runtime_error("WorkletsModule reference is null");
        }

        auto workletsModuleProxy =
            workletsModule->cthis()->getWorkletsModuleProxy();

        if (!workletsModuleProxy)
        {
            throw std::runtime_error("Failed to get WorkletsModuleProxy from WorkletsModule");
        }

        auto uiScheduler = workletsModuleProxy->getUIScheduler();
        if (!uiScheduler)
        {
            throw std::runtime_error("Failed to get UIScheduler from WorkletsModuleProxy");
        }

        auto uiWorkletRuntime = workletsModuleProxy->getUIWorkletRuntime();
        if (!uiWorkletRuntime)
        {
            throw std::runtime_error("Failed to get UIWorkletRuntime from WorkletsModuleProxy");
        }

        uiCallInvoker_ = std::make_shared<WorkletsUiCallInvoker>(uiScheduler, uiWorkletRuntime, isOnAndroidUiThread);
        return uiCallInvoker_;
    }

    jni::local_ref<react::CallInvokerHolder::javaobject>
    JHybridUiListModule::getUiCallInvokerHolder(
        jni::alias_ref<JHybridUiListModule> jThis,
        jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule)
    {
        std::shared_ptr<react::CallInvoker> uiCallInvoker = getOrInitCallInvoker(workletsModule);

        return react::CallInvokerHolder::newObjectCxxArgs(uiCallInvoker);
    }

    void JHybridUiListModule::prepareUiRuntime(
        jni::alias_ref<JHybridUiListModule> jThis,
        jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule)
    {
        if (!workletsModule)
        {
            throw std::runtime_error("WorkletsModule reference is null");
        }

        auto workletsModuleProxy =
            workletsModule->cthis()->getWorkletsModuleProxy();

        if (!workletsModuleProxy)
        {
            throw std::runtime_error("Failed to get WorkletsModuleProxy from WorkletsModule");
        }

        auto uiWorkletRuntime = workletsModuleProxy->getUIWorkletRuntime();
        if (!uiWorkletRuntime)
        {
            throw std::runtime_error("Failed to get UIWorkletRuntime from WorkletsModuleProxy");
        }

        std::shared_ptr<react::CallInvoker> uiCallInvoker = getOrInitCallInvoker(workletsModule);

        // React Native checks this global while installing TurboModule bindings.
        // Worklets creates a separate UI runtime, so we mirror the bridgeless marker there.
        uiWorkletRuntime->runSync([](jsi::Runtime &runtime)
                                  {
                                      if (!runtime.global().hasProperty(runtime, "RN$Bridgeless"))
                                      {
                                          react::defineReadOnlyGlobal(runtime, "RN$Bridgeless", jsi::Value(true));
                                      }
                                  });

        // Do not call the Android Nitro TurboModule installer from the UI runtime.
        // That installer reads ReactApplicationContext.javaScriptContextHolder, which always
        // points at the main RN JS runtime. Install Nitro directly into Worklets' UI runtime
        // so UI-thread imports can reuse global.NitroModulesProxy instead of reinstalling on RN.
        uiWorkletRuntime->runSync([uiCallInvoker](jsi::Runtime &runtime)
                                  {
                                      if (runtime.global().hasProperty(runtime, "NitroModulesProxy"))
                                      {
                                          return;
                                      }

                                      if (runtime.global().hasProperty(runtime, "__nitroDispatcher"))
                                      {
                                          margelo::nitro::install(runtime);
                                          return;
                                      }

                                      auto dispatcher =
                                          std::make_shared<margelo::nitro::CallInvokerDispatcher>(uiCallInvoker);
                                      margelo::nitro::install(runtime, dispatcher);
                                  });
    }

    jni::local_ref<react::JRuntimeExecutor::javaobject>
    JHybridUiListModule::getUiRuntimeExecutor(
        jni::alias_ref<JHybridUiListModule> jThis,
        jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule)
    {
        std::shared_ptr<react::CallInvoker> uiCallInvoker = getOrInitCallInvoker(workletsModule);

        RuntimeExecutor uiRuntimeExecutor = [uiCallInvoker](auto callback)
        {
            if (isOnAndroidUiThread())
            {
                uiCallInvoker->invokeSync(std::move(callback));
                return;
            }

            uiCallInvoker->invokeAsync(std::move(callback));
        };

        return react::JRuntimeExecutor::newObjectCxxArgs(uiRuntimeExecutor);
    }

    void JHybridUiListModule::setupEventInterceptor(
        jni::alias_ref<JHybridUiListModule> jThis,
        jni::alias_ref<JFabricUIManager::javaobject> fabricUIManager)
    {
        if (!uiCallInvoker_)
        {
            throw std::runtime_error(
                "UI CallInvoker must be initialized before setting up event interceptor");
        }

        if (!fabricUIManager)
        {
            throw std::runtime_error("FabricUIManager reference is null");
        }
        std::shared_ptr<react::Scheduler> scheduler = fabricUIManager->getBinding()->getScheduler();

        if (!scheduler)
        {
            throw std::runtime_error("Failed to get Scheduler from FabricUIManager");
        }

        HybridUiManagerHelper::setupEventInterceptor(scheduler, uiCallInvoker_);
    }

} // namespace margelo::nitro::reactnativelist
