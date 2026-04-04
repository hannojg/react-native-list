#include "WorkletsUiCallInvoker.hpp"

namespace margelo::nitro::nitrolist
{
    WorkletsUiCallInvoker::WorkletsUiCallInvoker(std::shared_ptr<worklets::UIScheduler> uiScheduler,
                                                 std::shared_ptr<worklets::WorkletRuntime> uiWorkletRuntime,
                                                 std::function<bool()> isOnUIThread)
        : uiScheduler_(uiScheduler), uiWorkletRuntime_(uiWorkletRuntime), isOnUIThread_(isOnUIThread) {}

    void WorkletsUiCallInvoker::invokeAsync(CallFunc &&func) noexcept
    {
        uiScheduler_->scheduleOnUI(
            [func = std::move(func), uiWorkletRuntime = uiWorkletRuntime_]()
            {
                jsi::Runtime &runtime = uiWorkletRuntime->getJSIRuntime();
                func(runtime);
            });

        if (isOnUIThread_())
        {
            return;
        }

        uiScheduler_->triggerUI();
    }

    void WorkletsUiCallInvoker::invokeSync(facebook::react::CallFunc &&func)
    {
        if (!isOnUIThread_())
        {
            throw std::runtime_error("WorkletsUiCallInvoker::invokeSync must be called on the UI thread.");
        }

        uiWorkletRuntime_->runSync([func = std::move(func)](jsi::Runtime &runtime)
        {
            func(runtime);
        });
    }

} // namespace margelo::nitro::nitrolist
