/* eslint-disable @react-native/no-deep-imports, @typescript-eslint/no-unused-vars, no-dupe-keys, prettier/prettier */
// @ts-nocheck

import type * as ReactModule from 'react'

function nativeLog(...args: unknown[]): void {
  global._log?.(
    '[ReactFabricMirror] ' +
      args
        .map((a) => {
          try {
            return JSON.stringify(a)
          } catch (e) {
            return '<failed to parse> ' + String(a)
          }
        })
        .join(' ')
  )
}
global.log = nativeLog

const Reconciler = require('react-reconciler')

// FabricUIManager is basically a wrapper around global.nativeFabricUIManager
// but caches each function to avoid recreating a jsi::HostFunction on each call.
const {
  getFabricUIManager,
} = require('react-native/Libraries/ReactNative/FabricUIManager')
const uiManager = getFabricUIManager()

const {
  create: createAttributePayload,
  diff: diffAttributePayloads,
} = require('react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload')

const ReactNativeViewConfigRegistry = require('react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry')

global.rootHostContext = {}
global.childHostContext = {}

const {
  NoEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  ContinuousEventPriority,
  IdleEventPriority,
} = require('react-reconciler/constants')
global.currentUpdatePriority = NoEventPriority
let currentCompleteRootSync: null | ((surfaceId: number, childSet: unknown) => void) =
  null

global.rootContainersBySurfaceId = global.rootContainersBySurfaceId ?? {}

const {
  getPublicInstance,
} = require('../../../shims/react-fiber-config-fabric.js')

//#region Event handling
const EventPluginUtilsModule = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/EventPluginUtils')
const { setComponentTree } = EventPluginUtilsModule
const {
  injectEventPluginOrder,
  injectEventPluginsByName,
  plugins: legacyPlugins,
} = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/EventPluginRegistry')
const ResponderEventPluginModule = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/ResponderEventPlugin')
const ReactNativeEventPluginOrderModule = require('../../../../third_party/react/packages/react-native-renderer/src/ReactNativeEventPluginOrder')
const ReactFabricGlobalResponderHandlerModule = require('../../../../third_party/react/packages/react-native-renderer/src/ReactFabricGlobalResponderHandler')
const SyntheticEventModule = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/SyntheticEvent')
const accumulateIntoModule = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/accumulateInto')
const forEachAccumulatedModule = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/forEachAccumulated')
const {
  batchedUpdates,
} = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/ReactGenericBatching')
const {
  runEventsInBatch,
} = require('../../../../third_party/react/packages/react-native-renderer/src/legacy-events/EventBatching')
const { HostComponent } = require('react-reconciler/src/ReactWorkTags')

const ResponderEventPlugin =
  ResponderEventPluginModule.default ?? ResponderEventPluginModule
const ReactNativeEventPluginOrder =
  ReactNativeEventPluginOrderModule.default ?? ReactNativeEventPluginOrderModule
const ReactFabricGlobalResponderHandler =
  ReactFabricGlobalResponderHandlerModule.default ??
  ReactFabricGlobalResponderHandlerModule

const SyntheticEvent = SyntheticEventModule.default ?? SyntheticEventModule
const accumulateInto = accumulateIntoModule.default ?? accumulateIntoModule
const forEachAccumulated =
  forEachAccumulatedModule.default ?? forEachAccumulatedModule

const { customBubblingEventTypes, customDirectEventTypes } =
  ReactNativeViewConfigRegistry

function getParent(inst) {
  do {
    inst = inst.return
  } while (inst && inst.tag !== HostComponent)
  return inst || null
}

function traverseTwoPhase(inst, fn, arg, skipBubbling) {
  const path = []
  while (inst) {
    path.push(inst)
    inst = getParent(inst)
  }

  for (let i = path.length - 1; i >= 0; i--) {
    fn(path[i], 'captured', arg)
  }

  if (skipBubbling) {
    fn(path[0], 'bubbled', arg)
  } else {
    for (let i = 0; i < path.length; i++) {
      fn(path[i], 'bubbled', arg)
    }
  }
}

function getListener(inst, registrationName) {
  const stateNode = inst.stateNode
  if (stateNode == null) {
    return null
  }

  const props = EventPluginUtilsModule.getFiberCurrentPropsFromNode(stateNode)
  if (props == null) {
    return null
  }

  const listener = props[registrationName]
  if (listener != null && typeof listener !== 'function') {
    throw new Error(
      `Expected \`${registrationName}\` listener to be a function, got \`${typeof listener}\`.`
    )
  }
  return listener
}

function listenerAtPhase(inst, event, propagationPhase) {
  const registrationName =
    event.dispatchConfig.phasedRegistrationNames[propagationPhase]
  return getListener(inst, registrationName)
}

function accumulateDirectionalDispatches(inst, phase, event) {
  const listener = listenerAtPhase(inst, event, phase)
  if (listener) {
    event._dispatchListeners = accumulateInto(
      event._dispatchListeners,
      listener
    )
    event._dispatchInstances = accumulateInto(event._dispatchInstances, inst)
  }
}

function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    traverseTwoPhase(
      event._targetInst,
      accumulateDirectionalDispatches,
      event,
      false
    )
  }
}

function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle)
}

function accumulateCapturePhaseDispatches(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    traverseTwoPhase(
      event._targetInst,
      accumulateDirectionalDispatches,
      event,
      true
    )
  }
}

function accumulateDispatches(inst, _ignoredDirection, event) {
  if (inst && event && event.dispatchConfig.registrationName) {
    const registrationName = event.dispatchConfig.registrationName
    const listener = getListener(inst, registrationName)
    if (listener) {
      event._dispatchListeners = accumulateInto(
        event._dispatchListeners,
        listener
      )
      event._dispatchInstances = accumulateInto(event._dispatchInstances, inst)
    }
  }
}

function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event._targetInst, null, event)
  }
}

function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle)
}

const ReactNativeBridgeEventPlugin = {
  eventTypes: {},
  extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
    if (targetInst == null) {
      return null
    }

    const bubbleDispatchConfig = customBubblingEventTypes[topLevelType]
    const directDispatchConfig = customDirectEventTypes[topLevelType]

    if (!bubbleDispatchConfig && !directDispatchConfig) {
      throw new Error(
        `Unsupported top level event type "${topLevelType}" dispatched`
      )
    }

    const event = SyntheticEvent.getPooled(
      bubbleDispatchConfig || directDispatchConfig,
      targetInst,
      nativeEvent,
      nativeEventTarget
    )

    if (bubbleDispatchConfig) {
      const skipBubbling =
        event != null &&
        event.dispatchConfig.phasedRegistrationNames != null &&
        event.dispatchConfig.phasedRegistrationNames.skipBubbling
      if (skipBubbling) {
        accumulateCapturePhaseDispatches(event)
      } else {
        accumulateTwoPhaseDispatches(event)
      }
    } else if (directDispatchConfig) {
      accumulateDirectDispatches(event)
    } else {
      return null
    }

    return event
  },
}

function extractPluginEvents(
  topLevelType,
  targetInst,
  nativeEvent,
  nativeEventTarget
) {
  let events = null
  for (let i = 0; i < legacyPlugins.length; i++) {
    const plugin = legacyPlugins[i]
    if (plugin) {
      const extractedEvents = plugin.extractEvents(
        topLevelType,
        targetInst,
        nativeEvent,
        nativeEventTarget
      )
      if (extractedEvents) {
        events = accumulateInto(events, extractedEvents)
      }
    }
  }
  return events
}

function runExtractedPluginEventsInBatch(
  topLevelType,
  targetInst,
  nativeEvent,
  nativeEventTarget
) {
  const events = extractPluginEvents(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget
  )
  runEventsInBatch(events)
}

function ensureLegacyEventPluginsInjected() {
  try {
    injectEventPluginOrder(ReactNativeEventPluginOrder)
  } catch (error) {
    // The plugin order can only be injected once for a given registry instance.
    if (
      !String(error).includes(
        'Cannot inject event plugin ordering more than once'
      )
    ) {
      throw error
    }
  }

  injectEventPluginsByName({
    ResponderEventPlugin,
    ReactNativeBridgeEventPlugin,
  })

  setComponentTree(
    // Equivalent to ReactFabricComponentTree.getFiberCurrentPropsFromNode
    (instance) => instance?.canonical?.currentProps ?? null,
    // Equivalent to ReactFabricComponentTree.getInstanceFromNode
    (node) => {
      if (
        node?.canonical != null &&
        node.canonical.internalInstanceHandle != null
      ) {
        return node.canonical.internalInstanceHandle
      }
      return node ?? null
    },
    // Equivalent to ReactFabricComponentTree.getNodeFromInstance
    (fiber) => {
      const publicInstance = getPublicInstance(fiber.stateNode)
      if (publicInstance == null) {
        throw new Error('Could not find host instance from fiber')
      }
      return publicInstance
    }
  )

  ResponderEventPlugin.injection.injectGlobalResponderHandler(
    ReactFabricGlobalResponderHandler
  )
}

ensureLegacyEventPluginsInjected()

function dispatchEvent(target, topLevelType, nativeEvent) {
  const targetFiber = target
  let eventTarget = null
  if (targetFiber != null) {
    const stateNode = targetFiber.stateNode
    if (stateNode != null) {
      eventTarget = getPublicInstance(stateNode)
    }
  }

  batchedUpdates(() => {
    runExtractedPluginEventsInBatch(
      topLevelType,
      targetFiber,
      nativeEvent,
      eventTarget
    )
  })
}

// This will be retrieved on the native side in JSI ... hm or we call and set it?
global.handleEvent = dispatchEvent
//#endregion

// Counter for uniquely identifying views.
// % 10 === 1 means it is a rootTag.
// % 2 === 0 means it is a Fabric tag.
// This means that they never overlap.
global.nextReactTag = 200_000_000
// ^ Why is this number so high?
// We share the ReactInstance (ie we don't create a seperate one)
// That means our surface shares the RCTComponentViewRegistry on iOS with the main React Native renderer.
// When creating new views its checking if the tag already exists, meaning we can't use the same tags that react is using. Bummer!\
// TODO: find a better solution for this

const HostConfig = {
  now: performance.now,
  getRootHostContext(rootContainerInstance) {
    return global.rootHostContext
  },
  getChildHostContext() {
    return global.childHostContext
  },
  //   prepareForCommit(containerInfo) {},
  //   resetAfterCommit(containerInfo) {},
  supportsPersistence: true,
  createInstance: (
    type,
    props,
    rootContainerInstance,
    _currentHostContext,
    workInProgress
  ) => {
    const tag = global.nextReactTag
    global.nextReactTag += 2

    const viewConfig = ReactNativeViewConfigRegistry.get(type)
    const updatePayload = createAttributePayload(
      props,
      viewConfig.validAttributes
    )

    let node
    try {
      nativeLog(
        '[createInstance] calling createNode with type=',
        type,
        'tag=',
        tag
      )
      nativeLog('[createInstance] props=', updatePayload)
      node = uiManager.createNode(
        tag, // reactTag
        viewConfig.uiViewClassName, // viewName
        rootContainerInstance.containerTag, // rootTag
        updatePayload, // props
        workInProgress // internalInstanceHandle
      )
    } catch (e) {
      nativeLog(
        '[createInstance] ERROR in createNode:',
        e.message || String(e)
      )
      nativeLog('Stack:', new Error().stack)
      throw e
    }

    return {
      node: node,
      canonical: {
        nativeTag: tag,
        viewConfig, // TODO: is this needed? for what
        currentProps: props, // funny, react is passing here props instead of updatePayload, is this okay?
        internalInstanceHandle: workInProgress,
        publicInstance: null,
        publicRootInstance: rootContainerInstance.publicInstance,
      },
    }
  },

  finalizeInitialChildren(parentInstance, type, props, hostContext) {
    nativeLog('[finalizeInitialChildren]')
    return false
  },

  cloneInstance(instance, type, oldProps, newProps, keepChildren, newChildSet) {
    nativeLog('[cloneInstance] tag=', instance.canonical.nativeTag)

    const viewConfig = instance.canonical.viewConfig
    const updatePayload = diffAttributePayloads(
      oldProps,
      newProps,
      viewConfig.validAttributes
    )
    nativeLog('[cloneInstance] updatePayload=', updatePayload)
    // TODO: If the event handlers have changed, we need to update the current props
    // in the commit phase but there is no host config hook to do it yet.
    // So instead we hack it by updating it in the render phase.
    instance.canonical.currentProps = newProps

    const node = instance.node
    let clone
    if (keepChildren) {
      if (updatePayload !== null) {
        clone = uiManager.cloneNodeWithNewProps(node, updatePayload)
      } else {
        // No changes
        return instance
      }
    } else {
      // If passChildrenWhenCloningPersistedNodes is enabled, children will be non-null
      if (newChildSet != null) {
        if (updatePayload !== null) {
          clone = uiManager.cloneNodeWithNewChildrenAndProps(
            node,
            newChildSet,
            updatePayload
          )
        } else {
          clone = uiManager.cloneNodeWithNewChildren(node, newChildSet)
        }
      } else {
        if (updatePayload !== null) {
          clone = uiManager.cloneNodeWithNewChildrenAndProps(
            node,
            updatePayload
          )
        } else {
          clone = uiManager.cloneNodeWithNewChildren(node)
        }
      }
    }

    return {
      node: clone,
      canonical: instance.canonical,
    }
  },
  createTextInstance(
    text,
    rootContainerInstance,
    hostContext,
    internalInstanceHandle
  ) {
    const tag = global.nextReactTag
    global.nextReactTag += 2

    const node = uiManager.createNode(
      tag, // reactTag
      'RCTRawText', // viewName
      rootContainerInstance.containerTag, // rootTag
      { text: text }, // props
      internalInstanceHandle // instance handle
    )

    return {
      node: node,
    }
  },
  createContainerChildSet() {
    nativeLog('[createContainerChildSet]')
    return uiManager.createChildSet()
  },
  appendChildToContainerChildSet(childSet, child) {
    nativeLog('[appendChildToContainerChildSet]')
    uiManager.appendChildToSet(childSet, child.node)
  },
  finalizeContainerChildren(container, newChildren) {
    // Noop - children will be replaced in replaceContainerChildren
    nativeLog('[finalizeContainerChildren]')
  },
  appendInitialChild(parentInstance, child) {
    nativeLog('[appendInitialChild]')
    uiManager.appendChild(parentInstance.node, child.node)
  },
  replaceContainerChildren(container, newChildren) {
    nativeLog('[replaceContainerChildren]')
    const completeRootSync = currentCompleteRootSync
    if (completeRootSync == null) {
      throw new Error('completeRootSync callback is required.')
    }

    completeRootSync(container.containerTag, newChildren)
  },

  // TODO: hm, this could get problematic, to share event priorities between the fabric ui manager.
  // Maybe we need to create a clone of the ui manager? the important thing is that all view managers are resolved when we do so.
  // However that would concern me if commitHooks from reanimated would work.
  setCurrentUpdatePriority(priority) {
    global.currentUpdatePriority = priority
  },
  getCurrentUpdatePriority() {
    return global.currentUpdatePriority
  },
  resolveUpdatePriority() {
    if (global.currentUpdatePriority !== NoEventPriority) {
      return global.currentUpdatePriority
    } else {
      return DefaultEventPriority
    }
    // TODO:
    /*   const currentEventPriority = fabricGetCurrentEventPriority
    ? fabricGetCurrentEventPriority()
    : null;

  if (currentEventPriority != null) {
    switch (currentEventPriority) {
      case FabricDiscretePriority:
        return DiscreteEventPriority;
      case FabricContinuousPriority:
        return ContinuousEventPriority;
      case FabricIdlePriority:
        return IdleEventPriority;
      case FabricDefaultPriority:
      default:
        return DefaultEventPriority;
    }
  }

  return DefaultEventPriority; */
  },

  getPublicInstance(instance) {
    return getPublicInstance(instance)
  },

  // getPublicTextInstance(textInstance, internalInstanceHandle) {
  //   if (textInstance.publicInstance == null) {
  //     textInstance.publicInstance = createPublicTextInstance(
  //       internalInstanceHandle
  //     )
  //   }
  //   return textInstance.publicInstance
  // },
  // getPublicInstanceFromInternalInstanceHandle(internalInstanceHandle) {
  //   const instance = internalInstanceHandle.stateNode

  //   // React resets all the fields in the fiber when the component is unmounted
  //   // to prevent memory leaks.
  //   if (instance == null) {
  //     return null
  //   }

  //   if (internalInstanceHandle.tag === HostText) {
  //     const textInstance = instance
  //     return this.getPublicTextInstance(textInstance, internalInstanceHandle)
  //   }

  //   const elementInstance = internalInstanceHandle.stateNode
  //   return this.getPublicInstance(elementInstance)
  // },

  prepareForCommit(containerInfo) {
    return null
  },
  resetAfterCommit(containerInfo) {},

  trackSchedulerEvent() {},
  resolveEventType() {
    return null
  },
  resolveEventTimeStamp() {
    return -1.1
  },
  shouldAttemptEagerTransition() {
    return false
  },
  shouldSetTextContent(type, props) {
    return false
  },
  // TODO: microtask scheduling, should work with worklets on the UI thread i believe! not sure though if even RN implements this?
  supportsMicrotasks: false,

  detachDeletedInstance(node) {},
  beforeActiveInstanceBlur(internalInstanceHandle) {
    // noop
  },

  afterActiveInstanceBlur() {
    // noop
  },

  preparePortalMount(portalInstance) {
    // noop
  },

  detachDeletedInstance(node) {
    // noop
  },

  requestPostPaintCallback(callback) {
    // noop
  },

  maySuspendCommit(type, props) {
    return false
  },

  maySuspendCommitOnUpdate(type, oldProps, newProps) {
    return false
  },
  maySuspendCommitInSyncRender(type, props) {
    return false
  },

  preloadInstance(instance, type, props) {
    return true
  },
  startSuspendingCommit() {
    return null
  },
  suspendInstance(state, instance, type, props) {},

  suspendOnActiveViewTransition(state, container) {},

  waitForCommitToBeReady(state, timeoutOffset) {
    return null
  },

  getSuspendedCommitReason(state, rootContainer) {
    return null
  },

  isPrimaryRenderer: false,
}

const Renderer = Reconciler(HostConfig)
global.React = require('react')

function createRootContainer(surfaceId: number) {
  const rootInstance = {
    containerTag: surfaceId,
    publicInstance: null,
  }

  return Renderer.createContainer(
    rootInstance,
    0, // concurrentRoot ? 1 : 0
    null,
    false,
    null,
    'ui-renderer-' + surfaceId,
    function onUncaughtError(error, info) {
      nativeLog(
        '[Error][ReactFabricMirror] Uncaught error in React renderer: ',
        error,
        info
      )
    },
    function onCaughtError(error, info) {
      nativeLog(
        '[Error][ReactFabricMirror] Caught error in React renderer: ',
        error,
        info
      )
    },
    function onRecoverableError(error, info) {
      nativeLog(
        '[Error][ReactFabricMirror] Recoverable error in React renderer: ',
        error,
        info
      )
    },
    function nativeOnDefaultTransitionIndicator() {
      // Native doesn't have a default indicator.
    }
  )
}

function getRootContainer(surfaceId: number) {
  let rootContainer = global.rootContainersBySurfaceId[surfaceId]
  if (rootContainer == null) {
    rootContainer = createRootContainer(surfaceId)
    global.rootContainersBySurfaceId[surfaceId] = rootContainer
  }

  return rootContainer
}

function reactRender(
  surfaceId: number,
  element: ReactModule.ReactElement,
  callback?: () => void,
  completeRootSync?: (surfaceId: number, childSet: unknown) => void
): void {
  const rootContainer = getRootContainer(surfaceId)
  const previousCompleteRootSync = currentCompleteRootSync
  currentCompleteRootSync = completeRootSync ?? null

  // updateContainerSync + flushSyncWork is making the renderer work immediately/blocking/…sync
  try {
    Renderer.updateContainerSync(element, rootContainer, null, callback)
    // Renderer.flushPassiveEffects();
    Renderer.flushSyncWork()
    nativeLog('[ReactFabricMirror] updateContainer finished')
  } finally {
    currentCompleteRootSync = previousCompleteRootSync
  }
}

function disposeReactRoot(
  surfaceId: number,
  completeRootSync: (surfaceId: number, childSet: unknown) => void
): void {
  const rootContainer = global.rootContainersBySurfaceId[surfaceId]
  if (rootContainer == null) {
    return
  }

  const previousCompleteRootSync = currentCompleteRootSync
  currentCompleteRootSync = completeRootSync
  try {
    Renderer.updateContainerSync(null, rootContainer, null, null)
    Renderer.flushSyncWork()
    delete global.rootContainersBySurfaceId[surfaceId]
    nativeLog('[ReactFabricMirror] disposed root', surfaceId)
  } finally {
    currentCompleteRootSync = previousCompleteRootSync
  }
}
nativeLog('[ReactFabricMirror] ReactFabricMirror initialized')

export { disposeReactRoot, nativeLog, reactRender }
