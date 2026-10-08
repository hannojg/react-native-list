#pragma once

#include <ReactCommon/CallInvoker.h>
#include <ReactCommon/TurboModule.h>
#include <hermes/hermes.h>
#include <react/bridging/LongLivedObject.h>
#include <deque>
#include <memory>
#include <stdexcept>
#include <string>

namespace list::tests {

namespace jsi = facebook::jsi;
namespace react = facebook::react;

class QueuedInvoker final : public react::CallInvoker {
 public:
  explicit QueuedInvoker(jsi::Runtime &runtime) : runtime_(runtime) {}

  void invokeAsync(react::CallFunc &&function) noexcept override {
    queue_.push_back(std::move(function));
  }

  void invokeSync(react::CallFunc &&function) override {
    function(runtime_);
  }

  void drain() {
    size_t remaining = 1000;
    runtime_.drainMicrotasks();
    while (!queue_.empty()) {
      if (remaining == 0) {
        throw std::runtime_error("JS queue did not become idle after 1000 tasks");
      }
      --remaining;
      auto function = std::move(queue_.front());
      queue_.pop_front();
      function(runtime_);
      runtime_.drainMicrotasks();
    }
  }

  void clear() { queue_.clear(); }

 private:
  jsi::Runtime &runtime_;
  std::deque<react::CallFunc> queue_;
};

class InlineNativeInvoker final : public react::NativeMethodCallInvoker {
 public:
  void invokeAsync(const std::string &, react::NativeMethodCallFunc &&function) noexcept override {
    function();
  }

  void invokeSync(const std::string &, react::NativeMethodCallFunc &&function) override {
    function();
  }
};

class RuntimeFixture final {
 public:
  RuntimeFixture() {
    hermes::vm::RuntimeConfig::Builder configBuilder;
    configBuilder.withMicrotaskQueue(true);
    auto config = configBuilder.build();
    runtime_ = facebook::hermes::makeHermesRuntime(config);
    invoker = std::make_shared<QueuedInvoker>(*runtime_);
  }

  ~RuntimeFixture() {
    invoker->clear();
    auto &objects = react::LongLivedObjectCollection::get(*runtime_);
    objects.clear();
  }

  void install(const std::shared_ptr<react::TurboModule> &module) {
    auto object = jsi::Object::createFromHostObject(*runtime_, module);
    auto global = runtime_->global();
    global.setProperty(*runtime_, "native", std::move(object));
  }

  jsi::Value evaluate(const std::string &source) {
    auto buffer = std::make_unique<jsi::StringBuffer>(source);
    return runtime_->evaluateJavaScript(std::move(buffer), "native-runtime-test.js");
  }

  jsi::Runtime &runtime() { return *runtime_; }

  void expectNumber(const std::string &expression, double expected) {
    auto value = evaluate(expression);
    if (!value.isNumber() || value.getNumber() != expected) {
      throw std::runtime_error(expression + " did not equal " + std::to_string(expected));
    }
  }

 private:
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime_;

 public:
  std::shared_ptr<QueuedInvoker> invoker;
};

// Each factory creates a runtime-local wrapper. Its native instance can be shared or separate.
template <typename Factory>
void checkSharedState(Factory createModule) {
  RuntimeFixture root;
  RuntimeFixture ui;
  root.install(createModule(root.invoker));
  ui.install(createModule(ui.invoker));
  root.expectNumber("native.increment()", 1);
  ui.expectNumber("native.increment()", 2);
  root.expectNumber("native.increment()", 3);
}

template <typename Factory>
void checkCallbackAndPromiseRouting(Factory createModule) {
  RuntimeFixture root;
  RuntimeFixture ui;
  root.install(createModule(root.invoker));
  ui.install(createModule(ui.invoker));
  const std::string source = R"JS(
    globalThis.callbackValue = 0;
    globalThis.promiseValue = 0;
    native.callback(value => { callbackValue = value; });
    native.promise().then(value => { promiseValue = value; });
  )JS";
  root.evaluate(source);
  ui.evaluate(source);
  root.expectNumber("callbackValue + promiseValue", 0);
  ui.expectNumber("callbackValue + promiseValue", 0);
  ui.invoker->drain();
  ui.expectNumber("callbackValue", 42);
  ui.expectNumber("promiseValue", 43);
  root.expectNumber("callbackValue + promiseValue", 0);
  root.invoker->drain();
  root.expectNumber("callbackValue", 42);
  root.expectNumber("promiseValue", 43);
}

template <typename Factory>
void checkEventRouting(Factory createModule) {
  RuntimeFixture root;
  RuntimeFixture ui;
  root.install(createModule(root.invoker));
  root.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
  ui.install(createModule(ui.invoker));
  ui.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
  root.evaluate("native.emit();");
  root.expectNumber("events", 0);
  ui.expectNumber("events", 0);
  root.invoker->drain();
  root.expectNumber("events", 1);
  ui.invoker->drain();
  ui.expectNumber("events", 0);
}

template <typename Factory>
void checkRootEventsAfterUiTeardown(Factory createModule) {
  RuntimeFixture root;
  root.install(createModule(root.invoker));
  root.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
  {
    RuntimeFixture ui;
    ui.install(createModule(ui.invoker));
    ui.evaluate("native.onChanged(() => {});");
  }
  root.evaluate("native.emit();");
  root.invoker->drain();
  root.expectNumber("events", 1);
}

template <typename Factory>
void checkUiWrapperBeforeRoot(Factory createModule) {
  RuntimeFixture root;
  RuntimeFixture ui;
  ui.install(createModule(ui.invoker));
  ui.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
  root.install(createModule(root.invoker));
  root.evaluate("globalThis.events = 0; native.onChanged(() => { events++; });");
  ui.evaluate("native.emit();");
  root.invoker->drain();
  root.expectNumber("events", 1);
  ui.invoker->drain();
  ui.expectNumber("events", 0);
}

class HandwrittenCppModule final : public react::TurboModule {
 public:
  explicit HandwrittenCppModule(const std::shared_ptr<react::CallInvoker> &invoker)
      : TurboModule("HandwrittenCppModule", invoker) {}

 private:
  double counter_ = 0;

  jsi::Value create(jsi::Runtime &runtime, const jsi::PropNameID &name) override {
    if (name.utf8(runtime) == "increment") {
      return jsi::Function::createFromHostFunction(runtime, name, 0,
          [this](jsi::Runtime &, const jsi::Value &, const jsi::Value *, size_t) {
            return jsi::Value(++counter_);
          });
    }
    return jsi::Value::undefined();
  }
};

} // namespace list::tests
