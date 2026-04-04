#pragma once

#include <ReactCommon/CallInvokerHolder.h>
#include <react/jni/JRuntimeExecutor.h>
#include <fbjni/fbjni.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/renderer/core/EventListener.h>
#include <worklets/android/WorkletsModule.h>

namespace margelo::nitro::nitrolist
{

    using namespace facebook;

    struct JHybridUiListModule : public jni::JavaClass<JHybridUiListModule>
    {
        static auto constexpr kJavaDescriptor =
            "Lcom/margelo/nitro/nitrolist/HybridUiListModule;";

        static void registerNatives();

    private:
        static jni::local_ref<react::CallInvokerHolder::javaobject>
        getUiCallInvokerHolder(
            jni::alias_ref<JHybridUiListModule> jThis,
            jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule);

        static jni::local_ref<react::JRuntimeExecutor::javaobject>
        getUiRuntimeExecutor(
            jni::alias_ref<JHybridUiListModule> jThis,
            jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule);

        static void prepareUiRuntime(
            jni::alias_ref<JHybridUiListModule> jThis,
            jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule);

        static void setupEventInterceptor(
            jni::alias_ref<JHybridUiListModule> jThis,
            jni::alias_ref<JFabricUIManager::javaobject> fabricUIManager);

        static std::shared_ptr<react::CallInvoker> getOrInitCallInvoker(jni::alias_ref<worklets::WorkletsModule::javaobject> workletsModule);

    private:
        static std::shared_ptr<react::CallInvoker> uiCallInvoker_;
        static std::shared_ptr<const react::EventListener> eventInterceptor_;
    };

} // namespace margelo::nitro::nitrolist
