#pragma once

#include <NitroModules/JSIConverter.hpp>
#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/uimanager/primitives.h>

#include <utility>

namespace margelo::nitro
{
    template <>
    struct JSIConverter<facebook::react::ShadowNode::UnsharedListOfShared> final
    {
        static inline facebook::react::ShadowNode::UnsharedListOfShared fromJSI(
            jsi::Runtime &runtime,
            const jsi::Value &arg)
        {
            return facebook::react::shadowNodeListFromValue(runtime, arg);
        }

        static inline jsi::Value toJSI(
            jsi::Runtime &runtime,
            facebook::react::ShadowNode::UnsharedListOfShared arg)
        {
            return facebook::react::valueFromShadowNodeList(runtime, std::move(arg));
        }

        static inline bool canConvert(
            jsi::Runtime &,
            const jsi::Value &value)
        {
            return value.isObject();
        }
    };
}
