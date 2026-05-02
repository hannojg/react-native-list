
  var IS_REACT_ACT_ENVIRONMENT = false;
  var reportError = console.error;
  var MessageChannel = undefined;
  var __REACT_DEVTOOLS_GLOBAL_HOOK__ = undefined;
  var AbortController = undefined;

    
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// ../node_modules/@babel/runtime/helpers/interopRequireDefault.js
var require_interopRequireDefault = __commonJS((exports2, module2) => {
  function _interopRequireDefault(e) {
    return e && e.__esModule ? e : {
      default: e
    };
  }
  module2.exports = _interopRequireDefault, module2.exports.__esModule = true, module2.exports["default"] = module2.exports;
});

// ../node_modules/react-native/Libraries/Utilities/defineLazyObjectProperty.js
var require_defineLazyObjectProperty = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  function defineLazyObjectProperty(object, name, descriptor) {
    var get = descriptor.get;
    var enumerable = descriptor.enumerable !== false;
    var writable = descriptor.writable !== false;
    var value;
    var valueSet = false;
    function getValue() {
      if (!valueSet) {
        valueSet = true;
        setValue(get());
      }
      return value;
    }
    function setValue(newValue) {
      value = newValue;
      valueSet = true;
      Object.defineProperty(object, name, { value: newValue, configurable: true, enumerable, writable });
    }
    Object.defineProperty(object, name, { get: getValue, set: setValue, configurable: true, enumerable });
  }
  var _default = exports2.default = defineLazyObjectProperty;
});

// ../node_modules/react-native/Libraries/ReactNative/FabricUIManager.js
var require_FabricUIManager = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.getFabricUIManager = getFabricUIManager;
  var _defineLazyObjectProperty = _interopRequireDefault(require_defineLazyObjectProperty());
  var nativeFabricUIManagerProxy;
  var CACHED_PROPERTIES = ["createNode", "cloneNode", "cloneNodeWithNewChildren", "cloneNodeWithNewProps", "cloneNodeWithNewChildrenAndProps", "createChildSet", "appendChild", "appendChildToSet", "completeRoot", "measure", "measureInWindow", "measureLayout", "configureNextLayoutAnimation", "sendAccessibilityEvent", "findShadowNodeByTag_DEPRECATED", "setNativeProps", "dispatchCommand", "compareDocumentPosition", "getBoundingClientRect", "unstable_DefaultEventPriority", "unstable_DiscreteEventPriority", "unstable_ContinuousEventPriority", "unstable_IdleEventPriority", "unstable_getCurrentEventPriority"];
  function getFabricUIManager() {
    if (nativeFabricUIManagerProxy == null && global.nativeFabricUIManager != null) {
      nativeFabricUIManagerProxy = createProxyWithCachedProperties(global.nativeFabricUIManager, CACHED_PROPERTIES);
    }
    return nativeFabricUIManagerProxy;
  }
  function createProxyWithCachedProperties(implementation, propertiesToCache) {
    var proxy = Object.create(implementation);
    var _loop = function _loop2(propertyName2) {
      (0, _defineLazyObjectProperty.default)(proxy, propertyName2, { get: function get() {
        return implementation[propertyName2];
      } });
    };
    for (var propertyName of propertiesToCache) {
      _loop(propertyName);
    }
    return proxy;
  }
});

// ../node_modules/react-native/Libraries/StyleSheet/flattenStyle.js
var require_flattenStyle = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  function flattenStyle(style) {
    if (style === null || typeof style !== "object") {
      return;
    }
    if (!Array.isArray(style)) {
      return style;
    }
    var result = {};
    for (var i = 0, styleLength = style.length;i < styleLength; ++i) {
      var computedStyle = flattenStyle(style[i]);
      if (computedStyle) {
        for (var key in computedStyle) {
          result[key] = computedStyle[key];
        }
      }
    }
    return result;
  }
  var _default = exports2.default = flattenStyle;
});

// ../node_modules/react-native/Libraries/Utilities/differ/deepDiffer.js
var require_deepDiffer = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var logListeners;
  function unstable_setLogListeners(listeners) {
    logListeners = listeners;
  }
  function deepDiffer(one, two) {
    var maxDepthOrOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    var maybeOptions = arguments.length > 3 ? arguments[3] : undefined;
    var options = typeof maxDepthOrOptions === "number" ? maybeOptions : maxDepthOrOptions;
    var maxDepth = typeof maxDepthOrOptions === "number" ? maxDepthOrOptions : -1;
    if (maxDepth === 0) {
      return true;
    }
    if (one === two) {
      return false;
    }
    if (typeof one === "function" && typeof two === "function") {
      var unsafelyIgnoreFunctions = options == null ? undefined : options.unsafelyIgnoreFunctions;
      if (unsafelyIgnoreFunctions == null) {
        if (logListeners && logListeners.onDifferentFunctionsIgnored && (!options || !("unsafelyIgnoreFunctions" in options))) {
          logListeners.onDifferentFunctionsIgnored(one.name, two.name);
        }
        unsafelyIgnoreFunctions = true;
      }
      return !unsafelyIgnoreFunctions;
    }
    if (typeof one !== "object" || one === null) {
      return one !== two;
    }
    if (typeof two !== "object" || two === null) {
      return true;
    }
    if (one.constructor !== two.constructor) {
      return true;
    }
    if (Array.isArray(one)) {
      var len = one.length;
      if (two.length !== len) {
        return true;
      }
      for (var ii = 0;ii < len; ii++) {
        if (deepDiffer(one[ii], two[ii], maxDepth - 1, options)) {
          return true;
        }
      }
    } else {
      for (var key in one) {
        if (deepDiffer(one[key], two[key], maxDepth - 1, options)) {
          return true;
        }
      }
      for (var twoKey in two) {
        if (one[twoKey] === undefined && two[twoKey] !== undefined) {
          return true;
        }
      }
    }
    return false;
  }
  deepDiffer.unstable_setLogListeners = unstable_setLogListeners;
  var _default = exports2.default = deepDiffer;
});

// ../node_modules/react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload.js
var require_ReactNativeAttributePayload = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.create = create;
  exports2.diff = diff;
  var _flattenStyle = _interopRequireDefault(require_flattenStyle());
  var _deepDiffer = _interopRequireDefault(require_deepDiffer());
  var emptyObject = {};
  var removedKeys = null;
  var removedKeyCount = 0;
  var deepDifferOptions = { unsafelyIgnoreFunctions: true };
  function defaultDiffer(prevProp, nextProp) {
    if (typeof nextProp !== "object" || nextProp === null) {
      return true;
    } else {
      return (0, _deepDiffer.default)(prevProp, nextProp, deepDifferOptions);
    }
  }
  function restoreDeletedValuesInNestedArray(updatePayload, node, validAttributes) {
    if (Array.isArray(node)) {
      var i = node.length;
      while (i-- && removedKeyCount > 0) {
        restoreDeletedValuesInNestedArray(updatePayload, node[i], validAttributes);
      }
    } else if (node && removedKeyCount > 0) {
      var obj = node;
      for (var propKey in removedKeys) {
        if (!removedKeys[propKey]) {
          continue;
        }
        var nextProp = obj[propKey];
        if (nextProp === undefined) {
          continue;
        }
        var attributeConfig = validAttributes[propKey];
        if (!attributeConfig) {
          continue;
        }
        if (typeof nextProp === "function") {
          nextProp = true;
        }
        if (typeof nextProp === "undefined") {
          nextProp = null;
        }
        if (typeof attributeConfig !== "object") {
          updatePayload[propKey] = nextProp;
        } else if (typeof attributeConfig.diff === "function" || typeof attributeConfig.process === "function") {
          var nextValue = typeof attributeConfig.process === "function" ? attributeConfig.process(nextProp) : nextProp;
          updatePayload[propKey] = nextValue;
        }
        removedKeys[propKey] = false;
        removedKeyCount--;
      }
    }
  }
  function diffNestedArrayProperty(updatePayload, prevArray, nextArray, validAttributes) {
    var minLength = prevArray.length < nextArray.length ? prevArray.length : nextArray.length;
    var i;
    for (i = 0;i < minLength; i++) {
      updatePayload = diffNestedProperty(updatePayload, prevArray[i], nextArray[i], validAttributes);
    }
    for (;i < prevArray.length; i++) {
      updatePayload = clearNestedProperty(updatePayload, prevArray[i], validAttributes);
    }
    for (;i < nextArray.length; i++) {
      var nextProp = nextArray[i];
      if (!nextProp) {
        continue;
      }
      updatePayload = addNestedProperty(updatePayload, nextProp, validAttributes);
    }
    return updatePayload;
  }
  function diffNestedProperty(updatePayload, prevProp, nextProp, validAttributes) {
    if (!updatePayload && prevProp === nextProp) {
      return updatePayload;
    }
    if (!prevProp || !nextProp) {
      if (nextProp) {
        return addNestedProperty(updatePayload, nextProp, validAttributes);
      }
      if (prevProp) {
        return clearNestedProperty(updatePayload, prevProp, validAttributes);
      }
      return updatePayload;
    }
    if (!Array.isArray(prevProp) && !Array.isArray(nextProp)) {
      return diffProperties(updatePayload, prevProp, nextProp, validAttributes);
    }
    if (Array.isArray(prevProp) && Array.isArray(nextProp)) {
      return diffNestedArrayProperty(updatePayload, prevProp, nextProp, validAttributes);
    }
    if (Array.isArray(prevProp)) {
      return diffProperties(updatePayload, (0, _flattenStyle.default)(prevProp), nextProp, validAttributes);
    }
    return diffProperties(updatePayload, prevProp, (0, _flattenStyle.default)(nextProp), validAttributes);
  }
  function clearNestedProperty(updatePayload, prevProp, validAttributes) {
    if (!prevProp) {
      return updatePayload;
    }
    if (!Array.isArray(prevProp)) {
      return clearProperties(updatePayload, prevProp, validAttributes);
    }
    for (var i = 0;i < prevProp.length; i++) {
      updatePayload = clearNestedProperty(updatePayload, prevProp[i], validAttributes);
    }
    return updatePayload;
  }
  function diffProperties(updatePayload, prevProps, nextProps, validAttributes) {
    var attributeConfig;
    var nextProp;
    var prevProp;
    for (var propKey in nextProps) {
      attributeConfig = validAttributes[propKey];
      if (!attributeConfig) {
        continue;
      }
      prevProp = prevProps[propKey];
      nextProp = nextProps[propKey];
      if (typeof nextProp === "function") {
        var attributeConfigHasProcess = typeof attributeConfig === "object" && typeof attributeConfig.process === "function";
        if (!attributeConfigHasProcess) {
          nextProp = true;
          if (typeof prevProp === "function") {
            prevProp = true;
          }
        }
      }
      if (typeof nextProp === "undefined") {
        nextProp = null;
        if (typeof prevProp === "undefined") {
          prevProp = null;
        }
      }
      if (removedKeys) {
        removedKeys[propKey] = false;
      }
      if (updatePayload && updatePayload[propKey] !== undefined) {
        if (typeof attributeConfig !== "object") {
          updatePayload[propKey] = nextProp;
        } else if (typeof attributeConfig.diff === "function" || typeof attributeConfig.process === "function") {
          var nextValue = typeof attributeConfig.process === "function" ? attributeConfig.process(nextProp) : nextProp;
          updatePayload[propKey] = nextValue;
        }
        continue;
      }
      if (prevProp === nextProp) {
        continue;
      }
      if (typeof attributeConfig !== "object") {
        if (defaultDiffer(prevProp, nextProp)) {
          (updatePayload || (updatePayload = {}))[propKey] = nextProp;
        }
      } else if (typeof attributeConfig.diff === "function" || typeof attributeConfig.process === "function") {
        var shouldUpdate = prevProp === undefined || (typeof attributeConfig.diff === "function" ? attributeConfig.diff(prevProp, nextProp) : defaultDiffer(prevProp, nextProp));
        if (shouldUpdate) {
          var _nextValue = typeof attributeConfig.process === "function" ? attributeConfig.process(nextProp) : nextProp;
          (updatePayload || (updatePayload = {}))[propKey] = _nextValue;
        }
      } else {
        removedKeys = null;
        removedKeyCount = 0;
        updatePayload = diffNestedProperty(updatePayload, prevProp, nextProp, attributeConfig);
        if (removedKeyCount > 0 && updatePayload) {
          restoreDeletedValuesInNestedArray(updatePayload, nextProp, attributeConfig);
          removedKeys = null;
        }
      }
    }
    for (var _propKey in prevProps) {
      if (nextProps[_propKey] !== undefined) {
        continue;
      }
      attributeConfig = validAttributes[_propKey];
      if (!attributeConfig) {
        continue;
      }
      if (updatePayload && updatePayload[_propKey] !== undefined) {
        continue;
      }
      prevProp = prevProps[_propKey];
      if (prevProp === undefined) {
        continue;
      }
      if (typeof attributeConfig !== "object" || typeof attributeConfig.diff === "function" || typeof attributeConfig.process === "function") {
        (updatePayload || (updatePayload = {}))[_propKey] = null;
        if (!removedKeys) {
          removedKeys = {};
        }
        if (!removedKeys[_propKey]) {
          removedKeys[_propKey] = true;
          removedKeyCount++;
        }
      } else {
        updatePayload = clearNestedProperty(updatePayload, prevProp, attributeConfig);
      }
    }
    return updatePayload;
  }
  function addNestedProperty(payload, props, validAttributes) {
    if (Array.isArray(props)) {
      for (var i = 0;i < props.length; i++) {
        payload = addNestedProperty(payload, props[i], validAttributes);
      }
      return payload;
    }
    for (var propKey in props) {
      var prop = props[propKey];
      var attributeConfig = validAttributes[propKey];
      if (attributeConfig == null) {
        continue;
      }
      var newValue = undefined;
      if (prop === undefined) {
        if (payload && payload[propKey] !== undefined) {
          newValue = null;
        } else {
          continue;
        }
      } else if (typeof attributeConfig === "object") {
        if (typeof attributeConfig.process === "function") {
          newValue = attributeConfig.process(prop);
        } else if (typeof attributeConfig.diff === "function") {
          newValue = prop;
        }
      } else {
        if (typeof prop === "function") {
          newValue = true;
        } else {
          newValue = prop;
        }
      }
      if (newValue !== undefined) {
        if (!payload) {
          payload = {};
        }
        payload[propKey] = newValue;
        continue;
      }
      payload = addNestedProperty(payload, prop, attributeConfig);
    }
    return payload;
  }
  function clearProperties(updatePayload, prevProps, validAttributes) {
    return diffProperties(updatePayload, prevProps, emptyObject, validAttributes);
  }
  function create(props, validAttributes) {
    return addNestedProperty(null, props, validAttributes);
  }
  function diff(prevProps, nextProps, validAttributes) {
    return diffProperties(null, prevProps, nextProps, validAttributes);
  }
});

// shims/react-fiber-config-fabric.js
var require_react_fiber_config_fabric = __commonJS((exports2, module2) => {
  var ReactNativeElement = require("react-native/src/private/webapis/dom/nodes/ReactNativeElement").default;
  function getPublicInstance(instance) {
    if (instance?.canonical != null) {
      if (instance.canonical.publicInstance == null) {
        instance.canonical.publicInstance = new ReactNativeElement(instance.canonical.nativeTag, instance.canonical.viewConfig, instance.canonical.internalInstanceHandle, instance.canonical.publicRootInstance ?? null);
        instance.canonical.publicRootInstance = null;
      }
      return instance.canonical.publicInstance;
    }
    if (instance?.containerInfo?.publicInstance != null) {
      return instance.containerInfo.publicInstance;
    }
    if (instance?._nativeTag != null) {
      return instance;
    }
    return null;
  }
  module2.exports = {
    getPublicInstance
  };
});

// ../third_party/react/packages/shared/isArray.js
var require_isArray = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var isArrayImpl = Array.isArray;
  function isArray(a) {
    return isArrayImpl(a);
  }
  var _default = exports2.default = isArray;
});

// shims/react-current-fiber.js
var require_react_current_fiber = __commonJS((exports2, module2) => {
  function runWithFiberInDEV(_fiber, fn, ...args) {
    return fn(...args);
  }
  module2.exports = {
    runWithFiberInDEV
  };
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/EventPluginUtils.js
var require_EventPluginUtils = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.executeDirectDispatch = executeDirectDispatch;
  exports2.executeDispatch = executeDispatch;
  exports2.executeDispatchesInOrder = executeDispatchesInOrder;
  exports2.executeDispatchesInOrderStopAtTrue = executeDispatchesInOrderStopAtTrue;
  exports2.getNodeFromInstance = exports2.getInstanceFromNode = exports2.getFiberCurrentPropsFromNode = undefined;
  exports2.hasDispatches = hasDispatches;
  exports2.rethrowCaughtError = rethrowCaughtError;
  exports2.setComponentTree = setComponentTree;
  var _isArray = _interopRequireDefault(require_isArray());
  var _ReactCurrentFiber = require_react_current_fiber();
  var hasError = false;
  var caughtError = null;
  var getFiberCurrentPropsFromNode = exports2.getFiberCurrentPropsFromNode = null;
  var getInstanceFromNode = exports2.getInstanceFromNode = null;
  var getNodeFromInstance = exports2.getNodeFromInstance = null;
  function setComponentTree(getFiberCurrentPropsFromNodeImpl, getInstanceFromNodeImpl, getNodeFromInstanceImpl) {
    exports2.getFiberCurrentPropsFromNode = getFiberCurrentPropsFromNode = getFiberCurrentPropsFromNodeImpl;
    exports2.getInstanceFromNode = getInstanceFromNode = getInstanceFromNodeImpl;
    exports2.getNodeFromInstance = getNodeFromInstance = getNodeFromInstanceImpl;
    if (__DEV__) {
      if (!getNodeFromInstance || !getInstanceFromNode) {
        console.error("Injected " + "module is missing getNodeFromInstance or getInstanceFromNode.");
      }
    }
  }
  function validateEventDispatches(event) {
    if (__DEV__) {
      var dispatchListeners = event._dispatchListeners;
      var dispatchInstances = event._dispatchInstances;
      var listenersIsArr = (0, _isArray.default)(dispatchListeners);
      var listenersLen = listenersIsArr ? dispatchListeners.length : dispatchListeners ? 1 : 0;
      var instancesIsArr = (0, _isArray.default)(dispatchInstances);
      var instancesLen = instancesIsArr ? dispatchInstances.length : dispatchInstances ? 1 : 0;
      if (instancesIsArr !== listenersIsArr || instancesLen !== listenersLen) {
        console.error("EventPluginUtils: Invalid `event`.");
      }
    }
  }
  function executeDispatch(event, listener, inst) {
    event.currentTarget = getNodeFromInstance(inst);
    try {
      listener(event);
    } catch (error) {
      if (!hasError) {
        hasError = true;
        caughtError = error;
      } else {}
    }
    event.currentTarget = null;
  }
  function executeDispatchesInOrder(event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchInstances = event._dispatchInstances;
    if (__DEV__) {
      validateEventDispatches(event);
    }
    if ((0, _isArray.default)(dispatchListeners)) {
      for (var i = 0;i < dispatchListeners.length; i++) {
        if (event.isPropagationStopped()) {
          break;
        }
        var listener = dispatchListeners[i];
        var instance = dispatchInstances[i];
        if (__DEV__ && instance !== null) {
          (0, _ReactCurrentFiber.runWithFiberInDEV)(instance, executeDispatch, event, listener, instance);
        } else {
          executeDispatch(event, listener, instance);
        }
      }
    } else if (dispatchListeners) {
      var _listener = dispatchListeners;
      var _instance = dispatchInstances;
      if (__DEV__ && _instance !== null) {
        (0, _ReactCurrentFiber.runWithFiberInDEV)(_instance, executeDispatch, event, _listener, _instance);
      } else {
        executeDispatch(event, _listener, _instance);
      }
    }
    event._dispatchListeners = null;
    event._dispatchInstances = null;
  }
  function executeDispatchesInOrderStopAtTrueImpl(event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchInstances = event._dispatchInstances;
    if (__DEV__) {
      validateEventDispatches(event);
    }
    if ((0, _isArray.default)(dispatchListeners)) {
      for (var i = 0;i < dispatchListeners.length; i++) {
        if (event.isPropagationStopped()) {
          break;
        }
        if (dispatchListeners[i](event, dispatchInstances[i])) {
          return dispatchInstances[i];
        }
      }
    } else if (dispatchListeners) {
      if (dispatchListeners(event, dispatchInstances)) {
        return dispatchInstances;
      }
    }
    return null;
  }
  function executeDispatchesInOrderStopAtTrue(event) {
    var ret = executeDispatchesInOrderStopAtTrueImpl(event);
    event._dispatchInstances = null;
    event._dispatchListeners = null;
    return ret;
  }
  function executeDirectDispatch(event) {
    if (__DEV__) {
      validateEventDispatches(event);
    }
    var dispatchListener = event._dispatchListeners;
    var dispatchInstance = event._dispatchInstances;
    if ((0, _isArray.default)(dispatchListener)) {
      throw new Error("Invalid `event`.");
    }
    event.currentTarget = dispatchListener ? getNodeFromInstance(dispatchInstance) : null;
    var res = dispatchListener ? dispatchListener(event) : null;
    event.currentTarget = null;
    event._dispatchListeners = null;
    event._dispatchInstances = null;
    return res;
  }
  function hasDispatches(event) {
    return !!event._dispatchListeners;
  }
  function rethrowCaughtError() {
    if (hasError) {
      var error = caughtError;
      hasError = false;
      caughtError = null;
      throw error;
    }
  }
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/EventPluginRegistry.js
var require_EventPluginRegistry = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.eventNameDispatchConfigs = undefined;
  exports2.injectEventPluginOrder = injectEventPluginOrder;
  exports2.injectEventPluginsByName = injectEventPluginsByName;
  exports2.registrationNameModules = exports2.registrationNameDependencies = exports2.possibleRegistrationNames = exports2.plugins = undefined;
  var eventPluginOrder = null;
  var namesToPlugins = {};
  function recomputePluginOrdering() {
    if (!eventPluginOrder) {
      return;
    }
    for (var pluginName in namesToPlugins) {
      var pluginModule = namesToPlugins[pluginName];
      var pluginIndex = eventPluginOrder.indexOf(pluginName);
      if (pluginIndex <= -1) {
        throw new Error("EventPluginRegistry: Cannot inject event plugins that do not exist in " + `the plugin ordering, \`${pluginName}\`.`);
      }
      if (plugins[pluginIndex]) {
        continue;
      }
      if (!pluginModule.extractEvents) {
        throw new Error("EventPluginRegistry: Event plugins must implement an `extractEvents` " + `method, but \`${pluginName}\` does not.`);
      }
      plugins[pluginIndex] = pluginModule;
      var publishedEvents = pluginModule.eventTypes;
      for (var _eventName in publishedEvents) {
        if (!publishEventForPlugin(publishedEvents[_eventName], pluginModule, _eventName)) {
          throw new Error(`EventPluginRegistry: Failed to publish event \`${_eventName}\` for plugin \`${pluginName}\`.`);
        }
      }
    }
  }
  function publishEventForPlugin(dispatchConfig, pluginModule, eventName) {
    if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
      throw new Error("EventPluginRegistry: More than one plugin attempted to publish the same " + `event name, \`${eventName}\`.`);
    }
    eventNameDispatchConfigs[eventName] = dispatchConfig;
    var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
    if (phasedRegistrationNames) {
      for (var phaseName in phasedRegistrationNames) {
        if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
          var phasedRegistrationName = phasedRegistrationNames[phaseName];
          publishRegistrationName(phasedRegistrationName, pluginModule, eventName);
        }
      }
      return true;
    } else if (dispatchConfig.registrationName) {
      publishRegistrationName(dispatchConfig.registrationName, pluginModule, eventName);
      return true;
    }
    return false;
  }
  function publishRegistrationName(registrationName, pluginModule, eventName) {
    if (registrationNameModules[registrationName]) {
      throw new Error("EventPluginRegistry: More than one plugin attempted to publish the same " + `registration name, \`${registrationName}\`.`);
    }
    registrationNameModules[registrationName] = pluginModule;
    registrationNameDependencies[registrationName] = pluginModule.eventTypes[eventName].dependencies;
    if (__DEV__) {
      var _lowerCasedName = registrationName.toLowerCase();
      possibleRegistrationNames[_lowerCasedName] = registrationName;
      if (registrationName === "onDoubleClick") {
        possibleRegistrationNames.ondblclick = registrationName;
      }
    }
  }
  var plugins = exports2.plugins = [];
  var eventNameDispatchConfigs = exports2.eventNameDispatchConfigs = {};
  var registrationNameModules = exports2.registrationNameModules = {};
  var registrationNameDependencies = exports2.registrationNameDependencies = {};
  var possibleRegistrationNames = exports2.possibleRegistrationNames = __DEV__ ? {} : null;
  function injectEventPluginOrder(injectedEventPluginOrder) {
    if (eventPluginOrder) {
      throw new Error("EventPluginRegistry: Cannot inject event plugin ordering more than " + "once. You are likely trying to load more than one copy of React.");
    }
    eventPluginOrder = Array.prototype.slice.call(injectedEventPluginOrder);
    recomputePluginOrdering();
  }
  function injectEventPluginsByName(injectedNamesToPlugins) {
    var isOrderingDirty = false;
    for (var pluginName in injectedNamesToPlugins) {
      if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
        continue;
      }
      var pluginModule = injectedNamesToPlugins[pluginName];
      if (!namesToPlugins.hasOwnProperty(pluginName) || namesToPlugins[pluginName] !== pluginModule) {
        if (namesToPlugins[pluginName]) {
          throw new Error("EventPluginRegistry: Cannot inject two different event plugins " + `using the same name, \`${pluginName}\`.`);
        }
        namesToPlugins[pluginName] = pluginModule;
        isOrderingDirty = true;
      }
    }
    if (isOrderingDirty) {
      recomputePluginOrdering();
    }
  }
});

// ../third_party/react/packages/shared/assign.js
var require_assign = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var assign = Object.assign;
  var _default = exports2.default = assign;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/SyntheticEvent.js
var require_SyntheticEvent = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var _assign = _interopRequireDefault(require_assign());
  var EVENT_POOL_SIZE = 10;
  var EventInterface = { type: null, target: null, currentTarget: function currentTarget() {
    return null;
  }, eventPhase: null, bubbles: null, cancelable: null, timeStamp: function timeStamp(event) {
    return event.timeStamp || Date.now();
  }, defaultPrevented: null, isTrusted: null };
  function functionThatReturnsTrue() {
    return true;
  }
  function functionThatReturnsFalse() {
    return false;
  }
  function SyntheticEvent(dispatchConfig, targetInst, nativeEvent, nativeEventTarget) {
    if (__DEV__) {
      delete this.nativeEvent;
      delete this.preventDefault;
      delete this.stopPropagation;
      delete this.isDefaultPrevented;
      delete this.isPropagationStopped;
    }
    this.dispatchConfig = dispatchConfig;
    this._targetInst = targetInst;
    this.nativeEvent = nativeEvent;
    this._dispatchListeners = null;
    this._dispatchInstances = null;
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      if (!Interface.hasOwnProperty(propName)) {
        continue;
      }
      if (__DEV__) {
        delete this[propName];
      }
      var normalize = Interface[propName];
      if (normalize) {
        this[propName] = normalize(nativeEvent);
      } else {
        if (propName === "target") {
          this.target = nativeEventTarget;
        } else {
          this[propName] = nativeEvent[propName];
        }
      }
    }
    var defaultPrevented = nativeEvent.defaultPrevented != null ? nativeEvent.defaultPrevented : nativeEvent.returnValue === false;
    if (defaultPrevented) {
      this.isDefaultPrevented = functionThatReturnsTrue;
    } else {
      this.isDefaultPrevented = functionThatReturnsFalse;
    }
    this.isPropagationStopped = functionThatReturnsFalse;
    return this;
  }
  (0, _assign.default)(SyntheticEvent.prototype, { preventDefault: function preventDefault() {
    this.defaultPrevented = true;
    var event = this.nativeEvent;
    if (!event) {
      return;
    }
    if (event.preventDefault) {
      event.preventDefault();
    } else if (typeof event.returnValue !== "unknown") {
      event.returnValue = false;
    }
    this.isDefaultPrevented = functionThatReturnsTrue;
  }, stopPropagation: function stopPropagation() {
    var event = this.nativeEvent;
    if (!event) {
      return;
    }
    if (event.stopPropagation) {
      event.stopPropagation();
    } else if (typeof event.cancelBubble !== "unknown") {
      event.cancelBubble = true;
    }
    this.isPropagationStopped = functionThatReturnsTrue;
  }, persist: function persist() {
    this.isPersistent = functionThatReturnsTrue;
  }, isPersistent: functionThatReturnsFalse, destructor: function destructor() {
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      if (__DEV__) {
        Object.defineProperty(this, propName, getPooledWarningPropertyDefinition(propName, Interface[propName]));
      } else {
        this[propName] = null;
      }
    }
    this.dispatchConfig = null;
    this._targetInst = null;
    this.nativeEvent = null;
    this.isDefaultPrevented = functionThatReturnsFalse;
    this.isPropagationStopped = functionThatReturnsFalse;
    this._dispatchListeners = null;
    this._dispatchInstances = null;
    if (__DEV__) {
      Object.defineProperty(this, "nativeEvent", getPooledWarningPropertyDefinition("nativeEvent", null));
      Object.defineProperty(this, "isDefaultPrevented", getPooledWarningPropertyDefinition("isDefaultPrevented", functionThatReturnsFalse));
      Object.defineProperty(this, "isPropagationStopped", getPooledWarningPropertyDefinition("isPropagationStopped", functionThatReturnsFalse));
      Object.defineProperty(this, "preventDefault", getPooledWarningPropertyDefinition("preventDefault", function() {}));
      Object.defineProperty(this, "stopPropagation", getPooledWarningPropertyDefinition("stopPropagation", function() {}));
    }
  } });
  SyntheticEvent.Interface = EventInterface;
  SyntheticEvent.extend = function(Interface) {
    var Super = this;
    var E = function E2() {};
    E.prototype = Super.prototype;
    var prototype = new E;
    function Class() {
      return Super.apply(this, arguments);
    }
    (0, _assign.default)(prototype, Class.prototype);
    Class.prototype = prototype;
    Class.prototype.constructor = Class;
    Class.Interface = (0, _assign.default)({}, Super.Interface, Interface);
    Class.extend = Super.extend;
    addEventPoolingTo(Class);
    return Class;
  };
  addEventPoolingTo(SyntheticEvent);
  function getPooledWarningPropertyDefinition(propName, getVal) {
    function set(val) {
      var action = isFunction ? "setting the method" : "setting the property";
      warn(action, "This is effectively a no-op");
      return val;
    }
    function get() {
      var action = isFunction ? "accessing the method" : "accessing the property";
      var result = isFunction ? "This is a no-op function" : "This is set to null";
      warn(action, result);
      return getVal;
    }
    function warn(action, result) {
      if (__DEV__) {
        console.error("This synthetic event is reused for performance reasons. If you're seeing this, " + "you're %s `%s` on a released/nullified synthetic event. %s. " + "If you must keep the original synthetic event around, use event.persist(). " + "See https://react.dev/link/event-pooling for more information.", action, propName, result);
      }
    }
    var isFunction = typeof getVal === "function";
    return { configurable: true, set, get };
  }
  function createOrGetPooledEvent(dispatchConfig, targetInst, nativeEvent, nativeInst) {
    var EventConstructor = this;
    if (EventConstructor.eventPool.length) {
      var instance = EventConstructor.eventPool.pop();
      EventConstructor.call(instance, dispatchConfig, targetInst, nativeEvent, nativeInst);
      return instance;
    }
    return new EventConstructor(dispatchConfig, targetInst, nativeEvent, nativeInst);
  }
  function releasePooledEvent(event) {
    var EventConstructor = this;
    if (!(event instanceof EventConstructor)) {
      throw new Error("Trying to release an event instance into a pool of a different type.");
    }
    event.destructor();
    if (EventConstructor.eventPool.length < EVENT_POOL_SIZE) {
      EventConstructor.eventPool.push(event);
    }
  }
  function addEventPoolingTo(EventConstructor) {
    EventConstructor.getPooled = createOrGetPooledEvent;
    EventConstructor.eventPool = [];
    EventConstructor.release = releasePooledEvent;
  }
  var _default = exports2.default = SyntheticEvent;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/ResponderSyntheticEvent.js
var require_ResponderSyntheticEvent = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var _SyntheticEvent = _interopRequireDefault(require_SyntheticEvent());
  var ResponderSyntheticEvent = _SyntheticEvent.default.extend({ touchHistory: function touchHistory(nativeEvent) {
    return null;
  } });
  var _default = exports2.default = ResponderSyntheticEvent;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/ResponderTopLevelEventTypes.js
var require_ResponderTopLevelEventTypes = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.endDependencies = exports2.TOP_TOUCH_START = exports2.TOP_TOUCH_MOVE = exports2.TOP_TOUCH_END = exports2.TOP_TOUCH_CANCEL = exports2.TOP_SELECTION_CHANGE = exports2.TOP_SCROLL = undefined;
  exports2.isEndish = isEndish;
  exports2.isMoveish = isMoveish;
  exports2.isStartish = isStartish;
  exports2.startDependencies = exports2.moveDependencies = undefined;
  var TOP_TOUCH_START = exports2.TOP_TOUCH_START = "topTouchStart";
  var TOP_TOUCH_MOVE = exports2.TOP_TOUCH_MOVE = "topTouchMove";
  var TOP_TOUCH_END = exports2.TOP_TOUCH_END = "topTouchEnd";
  var TOP_TOUCH_CANCEL = exports2.TOP_TOUCH_CANCEL = "topTouchCancel";
  var TOP_SCROLL = exports2.TOP_SCROLL = "topScroll";
  var TOP_SELECTION_CHANGE = exports2.TOP_SELECTION_CHANGE = "topSelectionChange";
  function isStartish(topLevelType) {
    return topLevelType === TOP_TOUCH_START;
  }
  function isMoveish(topLevelType) {
    return topLevelType === TOP_TOUCH_MOVE;
  }
  function isEndish(topLevelType) {
    return topLevelType === TOP_TOUCH_END || topLevelType === TOP_TOUCH_CANCEL;
  }
  var startDependencies = exports2.startDependencies = [TOP_TOUCH_START];
  var moveDependencies = exports2.moveDependencies = [TOP_TOUCH_MOVE];
  var endDependencies = exports2.endDependencies = [TOP_TOUCH_CANCEL, TOP_TOUCH_END];
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/ResponderTouchHistoryStore.js
var require_ResponderTouchHistoryStore = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var _ResponderTopLevelEventTypes = require_ResponderTopLevelEventTypes();
  var MAX_TOUCH_BANK = 20;
  var touchBank = [];
  var touchHistory = { touchBank, numberActiveTouches: 0, indexOfSingleActiveTouch: -1, mostRecentTimeStamp: 0 };
  function timestampForTouch(touch) {
    return touch.timeStamp || touch.timestamp;
  }
  function createTouchRecord(touch) {
    return { touchActive: true, startPageX: touch.pageX, startPageY: touch.pageY, startTimeStamp: timestampForTouch(touch), currentPageX: touch.pageX, currentPageY: touch.pageY, currentTimeStamp: timestampForTouch(touch), previousPageX: touch.pageX, previousPageY: touch.pageY, previousTimeStamp: timestampForTouch(touch) };
  }
  function resetTouchRecord(touchRecord, touch) {
    touchRecord.touchActive = true;
    touchRecord.startPageX = touch.pageX;
    touchRecord.startPageY = touch.pageY;
    touchRecord.startTimeStamp = timestampForTouch(touch);
    touchRecord.currentPageX = touch.pageX;
    touchRecord.currentPageY = touch.pageY;
    touchRecord.currentTimeStamp = timestampForTouch(touch);
    touchRecord.previousPageX = touch.pageX;
    touchRecord.previousPageY = touch.pageY;
    touchRecord.previousTimeStamp = timestampForTouch(touch);
  }
  function getTouchIdentifier(_ref) {
    var identifier = _ref.identifier;
    if (identifier == null) {
      throw new Error("Touch object is missing identifier.");
    }
    if (__DEV__) {
      if (identifier > MAX_TOUCH_BANK) {
        console.error("Touch identifier %s is greater than maximum supported %s which causes " + "performance issues backfilling array locations for all of the indices.", identifier, MAX_TOUCH_BANK);
      }
    }
    return identifier;
  }
  function recordTouchStart(touch) {
    var identifier = getTouchIdentifier(touch);
    var touchRecord = touchBank[identifier];
    if (touchRecord) {
      resetTouchRecord(touchRecord, touch);
    } else {
      touchBank[identifier] = createTouchRecord(touch);
    }
    touchHistory.mostRecentTimeStamp = timestampForTouch(touch);
  }
  function recordTouchMove(touch) {
    var touchRecord = touchBank[getTouchIdentifier(touch)];
    if (touchRecord) {
      touchRecord.touchActive = true;
      touchRecord.previousPageX = touchRecord.currentPageX;
      touchRecord.previousPageY = touchRecord.currentPageY;
      touchRecord.previousTimeStamp = touchRecord.currentTimeStamp;
      touchRecord.currentPageX = touch.pageX;
      touchRecord.currentPageY = touch.pageY;
      touchRecord.currentTimeStamp = timestampForTouch(touch);
      touchHistory.mostRecentTimeStamp = timestampForTouch(touch);
    } else {
      if (__DEV__) {
        console.warn(`Cannot record touch move without a touch start.
` + `Touch Move: %s
` + "Touch Bank: %s", printTouch(touch), printTouchBank());
      }
    }
  }
  function recordTouchEnd(touch) {
    var touchRecord = touchBank[getTouchIdentifier(touch)];
    if (touchRecord) {
      touchRecord.touchActive = false;
      touchRecord.previousPageX = touchRecord.currentPageX;
      touchRecord.previousPageY = touchRecord.currentPageY;
      touchRecord.previousTimeStamp = touchRecord.currentTimeStamp;
      touchRecord.currentPageX = touch.pageX;
      touchRecord.currentPageY = touch.pageY;
      touchRecord.currentTimeStamp = timestampForTouch(touch);
      touchHistory.mostRecentTimeStamp = timestampForTouch(touch);
    } else {
      if (__DEV__) {
        console.warn(`Cannot record touch end without a touch start.
` + `Touch End: %s
` + "Touch Bank: %s", printTouch(touch), printTouchBank());
      }
    }
  }
  function printTouch(touch) {
    return JSON.stringify({ identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY, timestamp: timestampForTouch(touch) });
  }
  function printTouchBank() {
    var printed = JSON.stringify(touchBank.slice(0, MAX_TOUCH_BANK));
    if (touchBank.length > MAX_TOUCH_BANK) {
      printed += " (original size: " + touchBank.length + ")";
    }
    return printed;
  }
  var instrumentationCallback;
  var ResponderTouchHistoryStore = { instrument: function instrument(callback) {
    instrumentationCallback = callback;
  }, recordTouchTrack: function recordTouchTrack(topLevelType, nativeEvent) {
    if (instrumentationCallback != null) {
      instrumentationCallback(topLevelType, nativeEvent);
    }
    if ((0, _ResponderTopLevelEventTypes.isMoveish)(topLevelType)) {
      nativeEvent.changedTouches.forEach(recordTouchMove);
    } else if ((0, _ResponderTopLevelEventTypes.isStartish)(topLevelType)) {
      nativeEvent.changedTouches.forEach(recordTouchStart);
      touchHistory.numberActiveTouches = nativeEvent.touches.length;
      if (touchHistory.numberActiveTouches === 1) {
        touchHistory.indexOfSingleActiveTouch = nativeEvent.touches[0].identifier;
      }
    } else if ((0, _ResponderTopLevelEventTypes.isEndish)(topLevelType)) {
      nativeEvent.changedTouches.forEach(recordTouchEnd);
      touchHistory.numberActiveTouches = nativeEvent.touches.length;
      if (touchHistory.numberActiveTouches === 1) {
        for (var i = 0;i < touchBank.length; i++) {
          var touchTrackToCheck = touchBank[i];
          if (touchTrackToCheck != null && touchTrackToCheck.touchActive) {
            touchHistory.indexOfSingleActiveTouch = i;
            break;
          }
        }
        if (__DEV__) {
          var activeRecord = touchBank[touchHistory.indexOfSingleActiveTouch];
          if (activeRecord == null || !activeRecord.touchActive) {
            console.error("Cannot find single active touch.");
          }
        }
      }
    }
  }, touchHistory };
  var _default = exports2.default = ResponderTouchHistoryStore;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/accumulate.js
var require_accumulate = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var _isArray = _interopRequireDefault(require_isArray());
  function accumulate(current, next) {
    if (next == null) {
      throw new Error("Accumulated items must not be null or undefined.");
    }
    if (current == null) {
      return next;
    }
    if ((0, _isArray.default)(current)) {
      return current.concat(next);
    }
    if ((0, _isArray.default)(next)) {
      return [current].concat(next);
    }
    return [current, next];
  }
  var _default = exports2.default = accumulate;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/accumulateInto.js
var require_accumulateInto = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var _isArray = _interopRequireDefault(require_isArray());
  function accumulateInto(current, next) {
    if (next == null) {
      throw new Error("Accumulated items must not be null or undefined.");
    }
    if (current == null) {
      return next;
    }
    if ((0, _isArray.default)(current)) {
      if ((0, _isArray.default)(next)) {
        current.push.apply(current, next);
        return current;
      }
      current.push(next);
      return current;
    }
    if ((0, _isArray.default)(next)) {
      return [current].concat(next);
    }
    return [current, next];
  }
  var _default = exports2.default = accumulateInto;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/forEachAccumulated.js
var require_forEachAccumulated = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  function forEachAccumulated(arr, cb, scope) {
    if (Array.isArray(arr)) {
      arr.forEach(cb, scope);
    } else if (arr) {
      cb.call(scope, arr);
    }
  }
  var _default = exports2.default = forEachAccumulated;
});

// shims/react-work-tags.js
var require_react_work_tags = __commonJS((exports2, module2) => {
  var HostComponent = 5;
  module2.exports = {
    HostComponent
  };
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/ResponderEventPlugin.js
var require_ResponderEventPlugin = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  exports2.getLowestCommonAncestor = getLowestCommonAncestor;
  var _EventPluginUtils = require_EventPluginUtils();
  var _ResponderSyntheticEvent = _interopRequireDefault(require_ResponderSyntheticEvent());
  var _ResponderTouchHistoryStore = _interopRequireDefault(require_ResponderTouchHistoryStore());
  var _accumulate = _interopRequireDefault(require_accumulate());
  var _ResponderTopLevelEventTypes = require_ResponderTopLevelEventTypes();
  var _accumulateInto = _interopRequireDefault(require_accumulateInto());
  var _forEachAccumulated = _interopRequireDefault(require_forEachAccumulated());
  var _ReactWorkTags = require_react_work_tags();
  var responderInst = null;
  var trackedTouchCount = 0;
  function changeResponder(nextResponderInst, blockHostResponder) {
    var oldResponderInst = responderInst;
    responderInst = nextResponderInst;
    if (ResponderEventPlugin.GlobalResponderHandler !== null) {
      ResponderEventPlugin.GlobalResponderHandler.onChange(oldResponderInst, nextResponderInst, blockHostResponder);
    }
  }
  var eventTypes = { startShouldSetResponder: { phasedRegistrationNames: { bubbled: "onStartShouldSetResponder", captured: "onStartShouldSetResponderCapture" }, dependencies: _ResponderTopLevelEventTypes.startDependencies }, scrollShouldSetResponder: { phasedRegistrationNames: { bubbled: "onScrollShouldSetResponder", captured: "onScrollShouldSetResponderCapture" }, dependencies: [_ResponderTopLevelEventTypes.TOP_SCROLL] }, selectionChangeShouldSetResponder: { phasedRegistrationNames: { bubbled: "onSelectionChangeShouldSetResponder", captured: "onSelectionChangeShouldSetResponderCapture" }, dependencies: [_ResponderTopLevelEventTypes.TOP_SELECTION_CHANGE] }, moveShouldSetResponder: { phasedRegistrationNames: { bubbled: "onMoveShouldSetResponder", captured: "onMoveShouldSetResponderCapture" }, dependencies: _ResponderTopLevelEventTypes.moveDependencies }, responderStart: { registrationName: "onResponderStart", dependencies: _ResponderTopLevelEventTypes.startDependencies }, responderMove: { registrationName: "onResponderMove", dependencies: _ResponderTopLevelEventTypes.moveDependencies }, responderEnd: { registrationName: "onResponderEnd", dependencies: _ResponderTopLevelEventTypes.endDependencies }, responderRelease: { registrationName: "onResponderRelease", dependencies: _ResponderTopLevelEventTypes.endDependencies }, responderTerminationRequest: { registrationName: "onResponderTerminationRequest", dependencies: [] }, responderGrant: { registrationName: "onResponderGrant", dependencies: [] }, responderReject: { registrationName: "onResponderReject", dependencies: [] }, responderTerminate: { registrationName: "onResponderTerminate", dependencies: [] } };
  function getParent(inst) {
    do {
      inst = inst.return;
    } while (inst && inst.tag !== _ReactWorkTags.HostComponent);
    if (inst) {
      return inst;
    }
    return null;
  }
  function getLowestCommonAncestor(instA, instB) {
    var depthA = 0;
    for (var tempA = instA;tempA; tempA = getParent(tempA)) {
      depthA++;
    }
    var depthB = 0;
    for (var tempB = instB;tempB; tempB = getParent(tempB)) {
      depthB++;
    }
    while (depthA - depthB > 0) {
      instA = getParent(instA);
      depthA--;
    }
    while (depthB - depthA > 0) {
      instB = getParent(instB);
      depthB--;
    }
    var depth = depthA;
    while (depth--) {
      if (instA === instB || instA === instB.alternate) {
        return instA;
      }
      instA = getParent(instA);
      instB = getParent(instB);
    }
    return null;
  }
  function isAncestor(instA, instB) {
    while (instB) {
      if (instA === instB || instA === instB.alternate) {
        return true;
      }
      instB = getParent(instB);
    }
    return false;
  }
  function traverseTwoPhase(inst, fn, arg) {
    var path = [];
    while (inst) {
      path.push(inst);
      inst = getParent(inst);
    }
    var i;
    for (i = path.length;i-- > 0; ) {
      fn(path[i], "captured", arg);
    }
    for (i = 0;i < path.length; i++) {
      fn(path[i], "bubbled", arg);
    }
  }
  function getListener(inst, registrationName) {
    var stateNode = inst.stateNode;
    if (stateNode === null) {
      return null;
    }
    var props = (0, _EventPluginUtils.getFiberCurrentPropsFromNode)(stateNode);
    if (props === null) {
      return null;
    }
    var listener = props[registrationName];
    if (listener && typeof listener !== "function") {
      throw new Error(`Expected \`${registrationName}\` listener to be a function, instead got a value of \`${typeof listener}\` type.`);
    }
    return listener;
  }
  function listenerAtPhase(inst, event, propagationPhase) {
    var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
    return getListener(inst, registrationName);
  }
  function accumulateDirectionalDispatches(inst, phase, event) {
    if (__DEV__) {
      if (!inst) {
        console.error("Dispatching inst must not be null");
      }
    }
    var listener = listenerAtPhase(inst, event, phase);
    if (listener) {
      event._dispatchListeners = (0, _accumulateInto.default)(event._dispatchListeners, listener);
      event._dispatchInstances = (0, _accumulateInto.default)(event._dispatchInstances, inst);
    }
  }
  function accumulateDispatches(inst, ignoredDirection, event) {
    if (inst && event && event.dispatchConfig.registrationName) {
      var registrationName = event.dispatchConfig.registrationName;
      var listener = getListener(inst, registrationName);
      if (listener) {
        event._dispatchListeners = (0, _accumulateInto.default)(event._dispatchListeners, listener);
        event._dispatchInstances = (0, _accumulateInto.default)(event._dispatchInstances, inst);
      }
    }
  }
  function accumulateDirectDispatchesSingle(event) {
    if (event && event.dispatchConfig.registrationName) {
      accumulateDispatches(event._targetInst, null, event);
    }
  }
  function accumulateDirectDispatches(events) {
    (0, _forEachAccumulated.default)(events, accumulateDirectDispatchesSingle);
  }
  function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
    if (event && event.dispatchConfig.phasedRegistrationNames) {
      var targetInst = event._targetInst;
      var parentInst = targetInst ? getParent(targetInst) : null;
      traverseTwoPhase(parentInst, accumulateDirectionalDispatches, event);
    }
  }
  function accumulateTwoPhaseDispatchesSkipTarget(events) {
    (0, _forEachAccumulated.default)(events, accumulateTwoPhaseDispatchesSingleSkipTarget);
  }
  function accumulateTwoPhaseDispatchesSingle(event) {
    if (event && event.dispatchConfig.phasedRegistrationNames) {
      traverseTwoPhase(event._targetInst, accumulateDirectionalDispatches, event);
    }
  }
  function accumulateTwoPhaseDispatches(events) {
    (0, _forEachAccumulated.default)(events, accumulateTwoPhaseDispatchesSingle);
  }
  function setResponderAndExtractTransfer(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
    var shouldSetEventType = (0, _ResponderTopLevelEventTypes.isStartish)(topLevelType) ? eventTypes.startShouldSetResponder : (0, _ResponderTopLevelEventTypes.isMoveish)(topLevelType) ? eventTypes.moveShouldSetResponder : topLevelType === _ResponderTopLevelEventTypes.TOP_SELECTION_CHANGE ? eventTypes.selectionChangeShouldSetResponder : eventTypes.scrollShouldSetResponder;
    var bubbleShouldSetFrom = !responderInst ? targetInst : getLowestCommonAncestor(responderInst, targetInst);
    var skipOverBubbleShouldSetFrom = bubbleShouldSetFrom === responderInst;
    var shouldSetEvent = _ResponderSyntheticEvent.default.getPooled(shouldSetEventType, bubbleShouldSetFrom, nativeEvent, nativeEventTarget);
    shouldSetEvent.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
    if (skipOverBubbleShouldSetFrom) {
      accumulateTwoPhaseDispatchesSkipTarget(shouldSetEvent);
    } else {
      accumulateTwoPhaseDispatches(shouldSetEvent);
    }
    var wantsResponderInst = (0, _EventPluginUtils.executeDispatchesInOrderStopAtTrue)(shouldSetEvent);
    if (!shouldSetEvent.isPersistent()) {
      shouldSetEvent.constructor.release(shouldSetEvent);
    }
    if (!wantsResponderInst || wantsResponderInst === responderInst) {
      return null;
    }
    var extracted;
    var grantEvent = _ResponderSyntheticEvent.default.getPooled(eventTypes.responderGrant, wantsResponderInst, nativeEvent, nativeEventTarget);
    grantEvent.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
    accumulateDirectDispatches(grantEvent);
    var blockHostResponder = (0, _EventPluginUtils.executeDirectDispatch)(grantEvent) === true;
    if (responderInst) {
      var terminationRequestEvent = _ResponderSyntheticEvent.default.getPooled(eventTypes.responderTerminationRequest, responderInst, nativeEvent, nativeEventTarget);
      terminationRequestEvent.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
      accumulateDirectDispatches(terminationRequestEvent);
      var shouldSwitch = !(0, _EventPluginUtils.hasDispatches)(terminationRequestEvent) || (0, _EventPluginUtils.executeDirectDispatch)(terminationRequestEvent);
      if (!terminationRequestEvent.isPersistent()) {
        terminationRequestEvent.constructor.release(terminationRequestEvent);
      }
      if (shouldSwitch) {
        var terminateEvent = _ResponderSyntheticEvent.default.getPooled(eventTypes.responderTerminate, responderInst, nativeEvent, nativeEventTarget);
        terminateEvent.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
        accumulateDirectDispatches(terminateEvent);
        extracted = (0, _accumulate.default)(extracted, [grantEvent, terminateEvent]);
        changeResponder(wantsResponderInst, blockHostResponder);
      } else {
        var rejectEvent = _ResponderSyntheticEvent.default.getPooled(eventTypes.responderReject, wantsResponderInst, nativeEvent, nativeEventTarget);
        rejectEvent.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
        accumulateDirectDispatches(rejectEvent);
        extracted = (0, _accumulate.default)(extracted, rejectEvent);
      }
    } else {
      extracted = (0, _accumulate.default)(extracted, grantEvent);
      changeResponder(wantsResponderInst, blockHostResponder);
    }
    return extracted;
  }
  function canTriggerTransfer(topLevelType, topLevelInst, nativeEvent) {
    return topLevelInst && (topLevelType === _ResponderTopLevelEventTypes.TOP_SCROLL && !nativeEvent.responderIgnoreScroll || trackedTouchCount > 0 && topLevelType === _ResponderTopLevelEventTypes.TOP_SELECTION_CHANGE || (0, _ResponderTopLevelEventTypes.isStartish)(topLevelType) || (0, _ResponderTopLevelEventTypes.isMoveish)(topLevelType));
  }
  function noResponderTouches(nativeEvent) {
    var touches = nativeEvent.touches;
    if (!touches || touches.length === 0) {
      return true;
    }
    for (var i = 0;i < touches.length; i++) {
      var activeTouch = touches[i];
      var target = activeTouch.target;
      if (target !== null && target !== undefined && target !== 0) {
        var targetInst = (0, _EventPluginUtils.getInstanceFromNode)(target);
        if (isAncestor(responderInst, targetInst)) {
          return false;
        }
      }
    }
    return true;
  }
  var ResponderEventPlugin = { _getResponder: function _getResponder() {
    return responderInst;
  }, eventTypes, extractEvents: function extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags) {
    if ((0, _ResponderTopLevelEventTypes.isStartish)(topLevelType)) {
      trackedTouchCount += 1;
    } else if ((0, _ResponderTopLevelEventTypes.isEndish)(topLevelType)) {
      if (trackedTouchCount >= 0) {
        trackedTouchCount -= 1;
      } else {
        if (__DEV__) {
          console.warn("Ended a touch event which was not counted in `trackedTouchCount`.");
        }
        return null;
      }
    }
    _ResponderTouchHistoryStore.default.recordTouchTrack(topLevelType, nativeEvent);
    var extracted = canTriggerTransfer(topLevelType, targetInst, nativeEvent) ? setResponderAndExtractTransfer(topLevelType, targetInst, nativeEvent, nativeEventTarget) : null;
    var isResponderTouchStart = responderInst && (0, _ResponderTopLevelEventTypes.isStartish)(topLevelType);
    var isResponderTouchMove = responderInst && (0, _ResponderTopLevelEventTypes.isMoveish)(topLevelType);
    var isResponderTouchEnd = responderInst && (0, _ResponderTopLevelEventTypes.isEndish)(topLevelType);
    var incrementalTouch = isResponderTouchStart ? eventTypes.responderStart : isResponderTouchMove ? eventTypes.responderMove : isResponderTouchEnd ? eventTypes.responderEnd : null;
    if (incrementalTouch) {
      var gesture = _ResponderSyntheticEvent.default.getPooled(incrementalTouch, responderInst, nativeEvent, nativeEventTarget);
      gesture.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
      accumulateDirectDispatches(gesture);
      extracted = (0, _accumulate.default)(extracted, gesture);
    }
    var isResponderTerminate = responderInst && topLevelType === _ResponderTopLevelEventTypes.TOP_TOUCH_CANCEL;
    var isResponderRelease = responderInst && !isResponderTerminate && (0, _ResponderTopLevelEventTypes.isEndish)(topLevelType) && noResponderTouches(nativeEvent);
    var finalTouch = isResponderTerminate ? eventTypes.responderTerminate : isResponderRelease ? eventTypes.responderRelease : null;
    if (finalTouch) {
      var finalEvent = _ResponderSyntheticEvent.default.getPooled(finalTouch, responderInst, nativeEvent, nativeEventTarget);
      finalEvent.touchHistory = _ResponderTouchHistoryStore.default.touchHistory;
      accumulateDirectDispatches(finalEvent);
      extracted = (0, _accumulate.default)(extracted, finalEvent);
      changeResponder(null);
    }
    return extracted;
  }, GlobalResponderHandler: null, injection: { injectGlobalResponderHandler: function injectGlobalResponderHandler(GlobalResponderHandler) {
    ResponderEventPlugin.GlobalResponderHandler = GlobalResponderHandler;
  } } };
  var _default = exports2.default = ResponderEventPlugin;
});

// ../third_party/react/packages/react-native-renderer/src/ReactNativeEventPluginOrder.js
var require_ReactNativeEventPluginOrder = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var ReactNativeEventPluginOrder = ["ResponderEventPlugin", "ReactNativeBridgeEventPlugin"];
  var _default = exports2.default = ReactNativeEventPluginOrder;
});

// ../third_party/react/packages/react-native-renderer/src/ReactFabricGlobalResponderHandler.js
var require_ReactFabricGlobalResponderHandler = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.default = undefined;
  var ReactFabricGlobalResponderHandler = { onChange: function onChange(from, to, blockNativeResponder) {
    if (from && from.stateNode) {
      nativeFabricUIManager.setIsJSResponder(from.stateNode.node, false, blockNativeResponder || false);
    }
    if (to && to.stateNode) {
      nativeFabricUIManager.setIsJSResponder(to.stateNode.node, true, blockNativeResponder || false);
    }
  } };
  var _default = exports2.default = ReactFabricGlobalResponderHandler;
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/ReactGenericBatching.js
var require_ReactGenericBatching = __commonJS((exports2) => {
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.batchedUpdates = batchedUpdates;
  exports2.discreteUpdates = discreteUpdates;
  exports2.setBatchingImplementation = setBatchingImplementation;
  var batchedUpdatesImpl = function batchedUpdatesImpl2(fn, bookkeeping) {
    return fn(bookkeeping);
  };
  var discreteUpdatesImpl = function discreteUpdatesImpl2(fn, a, b, c, d) {
    return fn(a, b, c, d);
  };
  var isInsideEventHandler = false;
  function batchedUpdates(fn, bookkeeping) {
    if (isInsideEventHandler) {
      return fn(bookkeeping);
    }
    isInsideEventHandler = true;
    try {
      return batchedUpdatesImpl(fn, bookkeeping);
    } finally {
      isInsideEventHandler = false;
    }
  }
  function discreteUpdates(fn, a, b, c, d) {
    var prevIsInsideEventHandler = isInsideEventHandler;
    isInsideEventHandler = true;
    try {
      return discreteUpdatesImpl(fn, a, b, c, d);
    } finally {
      isInsideEventHandler = prevIsInsideEventHandler;
    }
  }
  function setBatchingImplementation(_batchedUpdatesImpl, _discreteUpdatesImpl) {
    batchedUpdatesImpl = _batchedUpdatesImpl;
    discreteUpdatesImpl = _discreteUpdatesImpl;
  }
});

// ../third_party/react/packages/react-native-renderer/src/legacy-events/EventBatching.js
var require_EventBatching = __commonJS((exports2) => {
  var _interopRequireDefault = require_interopRequireDefault();
  Object.defineProperty(exports2, "__esModule", { value: true });
  exports2.runEventsInBatch = runEventsInBatch;
  var _accumulateInto = _interopRequireDefault(require_accumulateInto());
  var _forEachAccumulated = _interopRequireDefault(require_forEachAccumulated());
  var _EventPluginUtils = require_EventPluginUtils();
  var eventQueue = null;
  function executeDispatchesAndRelease(event) {
    if (event) {
      (0, _EventPluginUtils.executeDispatchesInOrder)(event);
      if (!event.isPersistent()) {
        event.constructor.release(event);
      }
    }
  }
  function executeDispatchesAndReleaseTopLevel(e) {
    return executeDispatchesAndRelease(e);
  }
  function runEventsInBatch(events) {
    if (events !== null) {
      eventQueue = (0, _accumulateInto.default)(eventQueue, events);
    }
    var processingEventQueue = eventQueue;
    eventQueue = null;
    if (!processingEventQueue) {
      return;
    }
    (0, _forEachAccumulated.default)(processingEventQueue, executeDispatchesAndReleaseTopLevel);
    if (eventQueue) {
      throw new Error("processEventQueue(): Additional events were enqueued while processing " + "an event queue. Support for this has not yet been implemented.");
    }
    (0, _EventPluginUtils.rethrowCaughtError)();
  }
});

// src/renderer/react/ReactFabricMirror.ts
var exports_ReactFabricMirror = {};
__export(exports_ReactFabricMirror, {
  reactRender: () => reactRender,
  nativeLog: () => nativeLog
});
module.exports = __toCommonJS(exports_ReactFabricMirror);
function nativeLog(...args) {
  global._log?.("[ReactFabricMirror] " + args.map((a) => {
    try {
      return JSON.stringify(a);
    } catch (e) {
      return "<failed to parse> " + String(a);
    }
  }).join(" "));
}
global.log = nativeLog;
var Reconciler = require("react-reconciler");
var {
  getFabricUIManager
} = require_FabricUIManager();
var uiManager = getFabricUIManager();
var {
  create: createAttributePayload,
  diff: diffAttributePayloads
} = require_ReactNativeAttributePayload();
var ReactNativeViewConfigRegistry = require("react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry");
global.rootHostContext = {};
global.childHostContext = {};
var {
  NoEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  ContinuousEventPriority,
  IdleEventPriority
} = require("react-reconciler/constants");
global.currentUpdatePriority = NoEventPriority;
global.rootInstance = {
  containerTag: 3,
  publicInstance: null
};
var {
  getPublicInstance
} = require_react_fiber_config_fabric();
var EventPluginUtilsModule = require_EventPluginUtils();
var { setComponentTree } = EventPluginUtilsModule;
var {
  injectEventPluginOrder,
  injectEventPluginsByName,
  plugins: legacyPlugins
} = require_EventPluginRegistry();
var ResponderEventPluginModule = require_ResponderEventPlugin();
var ReactNativeEventPluginOrderModule = require_ReactNativeEventPluginOrder();
var ReactFabricGlobalResponderHandlerModule = require_ReactFabricGlobalResponderHandler();
var SyntheticEventModule = require_SyntheticEvent();
var accumulateIntoModule = require_accumulateInto();
var forEachAccumulatedModule = require_forEachAccumulated();
var {
  batchedUpdates
} = require_ReactGenericBatching();
var {
  runEventsInBatch
} = require_EventBatching();
var { HostComponent } = require_react_work_tags();
var ResponderEventPlugin = ResponderEventPluginModule.default ?? ResponderEventPluginModule;
var ReactNativeEventPluginOrder = ReactNativeEventPluginOrderModule.default ?? ReactNativeEventPluginOrderModule;
var ReactFabricGlobalResponderHandler = ReactFabricGlobalResponderHandlerModule.default ?? ReactFabricGlobalResponderHandlerModule;
var SyntheticEvent = SyntheticEventModule.default ?? SyntheticEventModule;
var accumulateInto = accumulateIntoModule.default ?? accumulateIntoModule;
var forEachAccumulated = forEachAccumulatedModule.default ?? forEachAccumulatedModule;
var { customBubblingEventTypes, customDirectEventTypes } = ReactNativeViewConfigRegistry;
function getParent(inst) {
  do {
    inst = inst.return;
  } while (inst && inst.tag !== HostComponent);
  return inst || null;
}
function traverseTwoPhase(inst, fn, arg, skipBubbling) {
  const path = [];
  while (inst) {
    path.push(inst);
    inst = getParent(inst);
  }
  for (let i = path.length - 1;i >= 0; i--) {
    fn(path[i], "captured", arg);
  }
  if (skipBubbling) {
    fn(path[0], "bubbled", arg);
  } else {
    for (let i = 0;i < path.length; i++) {
      fn(path[i], "bubbled", arg);
    }
  }
}
function getListener(inst, registrationName) {
  const stateNode = inst.stateNode;
  if (stateNode == null) {
    return null;
  }
  const props = EventPluginUtilsModule.getFiberCurrentPropsFromNode(stateNode);
  if (props == null) {
    return null;
  }
  const listener = props[registrationName];
  if (listener != null && typeof listener !== "function") {
    throw new Error(`Expected \`${registrationName}\` listener to be a function, got \`${typeof listener}\`.`);
  }
  return listener;
}
function listenerAtPhase(inst, event, propagationPhase) {
  const registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(inst, registrationName);
}
function accumulateDirectionalDispatches(inst, phase, event) {
  const listener = listenerAtPhase(inst, event, phase);
  if (listener) {
    event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
    event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
  }
}
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    traverseTwoPhase(event._targetInst, accumulateDirectionalDispatches, event, false);
  }
}
function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}
function accumulateCapturePhaseDispatches(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    traverseTwoPhase(event._targetInst, accumulateDirectionalDispatches, event, true);
  }
}
function accumulateDispatches(inst, _ignoredDirection, event) {
  if (inst && event && event.dispatchConfig.registrationName) {
    const registrationName = event.dispatchConfig.registrationName;
    const listener = getListener(inst, registrationName);
    if (listener) {
      event._dispatchListeners = accumulateInto(event._dispatchListeners, listener);
      event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
    }
  }
}
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event._targetInst, null, event);
  }
}
function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}
var ReactNativeBridgeEventPlugin = {
  eventTypes: {},
  extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
    if (targetInst == null) {
      return null;
    }
    const bubbleDispatchConfig = customBubblingEventTypes[topLevelType];
    const directDispatchConfig = customDirectEventTypes[topLevelType];
    if (!bubbleDispatchConfig && !directDispatchConfig) {
      throw new Error(`Unsupported top level event type "${topLevelType}" dispatched`);
    }
    const event = SyntheticEvent.getPooled(bubbleDispatchConfig || directDispatchConfig, targetInst, nativeEvent, nativeEventTarget);
    if (bubbleDispatchConfig) {
      const skipBubbling = event != null && event.dispatchConfig.phasedRegistrationNames != null && event.dispatchConfig.phasedRegistrationNames.skipBubbling;
      if (skipBubbling) {
        accumulateCapturePhaseDispatches(event);
      } else {
        accumulateTwoPhaseDispatches(event);
      }
    } else if (directDispatchConfig) {
      accumulateDirectDispatches(event);
    } else {
      return null;
    }
    return event;
  }
};
function extractPluginEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
  let events = null;
  for (let i = 0;i < legacyPlugins.length; i++) {
    const plugin = legacyPlugins[i];
    if (plugin) {
      const extractedEvents = plugin.extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget);
      if (extractedEvents) {
        events = accumulateInto(events, extractedEvents);
      }
    }
  }
  return events;
}
function runExtractedPluginEventsInBatch(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
  const events = extractPluginEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget);
  runEventsInBatch(events);
}
function ensureLegacyEventPluginsInjected() {
  try {
    injectEventPluginOrder(ReactNativeEventPluginOrder);
  } catch (error) {
    if (!String(error).includes("Cannot inject event plugin ordering more than once")) {
      throw error;
    }
  }
  injectEventPluginsByName({
    ResponderEventPlugin,
    ReactNativeBridgeEventPlugin
  });
  setComponentTree((instance) => instance?.canonical?.currentProps ?? null, (node) => {
    if (node?.canonical != null && node.canonical.internalInstanceHandle != null) {
      return node.canonical.internalInstanceHandle;
    }
    return node ?? null;
  }, (fiber) => {
    const publicInstance = getPublicInstance(fiber.stateNode);
    if (publicInstance == null) {
      throw new Error("Could not find host instance from fiber");
    }
    return publicInstance;
  });
  ResponderEventPlugin.injection.injectGlobalResponderHandler(ReactFabricGlobalResponderHandler);
}
ensureLegacyEventPluginsInjected();
function dispatchEvent(target, topLevelType, nativeEvent) {
  const targetFiber = target;
  let eventTarget = null;
  if (targetFiber != null) {
    const stateNode = targetFiber.stateNode;
    if (stateNode != null) {
      eventTarget = getPublicInstance(stateNode);
    }
  }
  batchedUpdates(() => {
    runExtractedPluginEventsInBatch(topLevelType, targetFiber, nativeEvent, eventTarget);
  });
}
global.handleEvent = dispatchEvent;
global.nextReactTag = 200000000;
var HostConfig = {
  now: performance.now,
  getRootHostContext(rootContainerInstance) {
    return global.rootHostContext;
  },
  getChildHostContext() {
    return global.childHostContext;
  },
  supportsPersistence: true,
  createInstance: (type, props, rootContainerInstance, _currentHostContext, workInProgress) => {
    const tag = global.nextReactTag;
    global.nextReactTag += 2;
    const viewConfig = ReactNativeViewConfigRegistry.get(type);
    const updatePayload = createAttributePayload(props, viewConfig.validAttributes);
    let node;
    try {
      nativeLog("[createInstance] calling createNode with type=", type, "tag=", tag);
      nativeLog("[createInstance] props=", updatePayload);
      node = uiManager.createNode(tag, viewConfig.uiViewClassName, rootContainerInstance.containerTag, updatePayload, workInProgress);
    } catch (e) {
      nativeLog("[createInstance] ERROR in createNode:", e.message || String(e));
      nativeLog("Stack:", new Error().stack);
      throw e;
    }
    return {
      node,
      canonical: {
        nativeTag: tag,
        viewConfig,
        currentProps: props,
        internalInstanceHandle: workInProgress,
        publicInstance: null,
        publicRootInstance: rootContainerInstance.publicInstance
      }
    };
  },
  finalizeInitialChildren(parentInstance, type, props, hostContext) {
    nativeLog("[finalizeInitialChildren]");
    return false;
  },
  cloneInstance(instance, type, oldProps, newProps, keepChildren, newChildSet) {
    nativeLog("[cloneInstance] tag=", instance.canonical.nativeTag);
    const viewConfig = instance.canonical.viewConfig;
    const updatePayload = diffAttributePayloads(oldProps, newProps, viewConfig.validAttributes);
    nativeLog("[cloneInstance] updatePayload=", updatePayload);
    instance.canonical.currentProps = newProps;
    const node = instance.node;
    let clone;
    if (keepChildren) {
      if (updatePayload !== null) {
        clone = uiManager.cloneNodeWithNewProps(node, updatePayload);
      } else {
        return instance;
      }
    } else {
      if (newChildSet != null) {
        if (updatePayload !== null) {
          clone = uiManager.cloneNodeWithNewChildrenAndProps(node, newChildSet, updatePayload);
        } else {
          clone = uiManager.cloneNodeWithNewChildren(node, newChildSet);
        }
      } else {
        if (updatePayload !== null) {
          clone = uiManager.cloneNodeWithNewChildrenAndProps(node, updatePayload);
        } else {
          clone = uiManager.cloneNodeWithNewChildren(node);
        }
      }
    }
    return {
      node: clone,
      canonical: instance.canonical
    };
  },
  createTextInstance(text, rootContainerInstance, hostContext, internalInstanceHandle) {
    const tag = global.nextReactTag;
    global.nextReactTag += 2;
    const node = uiManager.createNode(tag, "RCTRawText", rootContainerInstance.containerTag, { text }, internalInstanceHandle);
    return {
      node
    };
  },
  createContainerChildSet() {
    nativeLog("[createContainerChildSet]");
    return uiManager.createChildSet();
  },
  appendChildToContainerChildSet(childSet, child) {
    nativeLog("[appendChildToContainerChildSet]");
    uiManager.appendChildToSet(childSet, child.node);
  },
  finalizeContainerChildren(container, newChildren) {
    nativeLog("[finalizeContainerChildren]");
  },
  appendInitialChild(parentInstance, child) {
    nativeLog("[appendInitialChild]");
    uiManager.appendChild(parentInstance.node, child.node);
  },
  replaceContainerChildren(container, newChildren) {
    nativeLog("[replaceContainerChildren]");
    uiManager.completeRoot(container.containerTag, newChildren);
  },
  setCurrentUpdatePriority(priority) {
    global.currentUpdatePriority = priority;
  },
  getCurrentUpdatePriority() {
    return global.currentUpdatePriority;
  },
  resolveUpdatePriority() {
    if (global.currentUpdatePriority !== NoEventPriority) {
      return global.currentUpdatePriority;
    } else {
      return DefaultEventPriority;
    }
  },
  getPublicInstance(instance) {
    return getPublicInstance(instance);
  },
  prepareForCommit(containerInfo) {
    return null;
  },
  resetAfterCommit(containerInfo) {},
  trackSchedulerEvent() {},
  resolveEventType() {
    return null;
  },
  resolveEventTimeStamp() {
    return -1.1;
  },
  shouldAttemptEagerTransition() {
    return false;
  },
  shouldSetTextContent(type, props) {
    return false;
  },
  supportsMicrotasks: false,
  detachDeletedInstance(node) {},
  beforeActiveInstanceBlur(internalInstanceHandle) {},
  afterActiveInstanceBlur() {},
  preparePortalMount(portalInstance) {},
  detachDeletedInstance(node) {},
  requestPostPaintCallback(callback) {},
  maySuspendCommit(type, props) {
    return false;
  },
  maySuspendCommitOnUpdate(type, oldProps, newProps) {
    return false;
  },
  maySuspendCommitInSyncRender(type, props) {
    return false;
  },
  preloadInstance(instance, type, props) {
    return true;
  },
  startSuspendingCommit() {
    return null;
  },
  suspendInstance(state, instance, type, props) {},
  suspendOnActiveViewTransition(state, container) {},
  waitForCommitToBeReady(state, timeoutOffset) {
    return null;
  },
  getSuspendedCommitReason(state, rootContainer) {
    return null;
  },
  isPrimaryRenderer: false
};
var Renderer = Reconciler(HostConfig);
global.React = require("react");
function reactRender(element, callback) {
  if (!global.rootContainer) {
    global.rootContainer = Renderer.createContainer(global.rootInstance, 0, null, false, null, "ui-renderer", function onUncaughtError(error, info) {
      nativeLog("[Error][ReactFabricMirror] Uncaught error in React renderer: ", error, info);
    }, function onCaughtError(error, info) {
      nativeLog("[Error][ReactFabricMirror] Caught error in React renderer: ", error, info);
    }, function onRecoverableError(error, info) {
      nativeLog("[Error][ReactFabricMirror] Recoverable error in React renderer: ", error, info);
    }, function nativeOnDefaultTransitionIndicator() {});
  }
  Renderer.updateContainerSync(element, global.rootContainer, null, callback);
  Renderer.flushSyncWork();
  nativeLog("[ReactFabricMirror] updateContainer finished");
}
nativeLog("[ReactFabricMirror] ReactFabricMirror initialized");
