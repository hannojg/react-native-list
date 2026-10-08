'use strict'

function isReactNativeRuntime() {
  return global.__RUNTIME_KIND === 1
}

let cachedReactNativeRendererProxy
function getReactNativeRendererProxy() {
  if (cachedReactNativeRendererProxy == null) {
    // Intentionally lazy: avoid loading the default RN renderer in non-RN runtimes.
    // eslint-disable-next-line @react-native/no-deep-imports
    cachedReactNativeRendererProxy = require('react-native/Libraries/ReactNative/RendererProxy')
  }
  return cachedReactNativeRendererProxy
}

function getNodeFromInternalInstanceHandle(internalInstanceHandle) {
  if (isReactNativeRuntime()) {
    const renderer = getReactNativeRendererProxy()
    return renderer.getNodeFromInternalInstanceHandle(internalInstanceHandle)
  }

  const stateNode = internalInstanceHandle?.stateNode
  if (stateNode == null) {
    return null
  }
  return stateNode.node ?? stateNode
}

function getPublicInstanceFromInternalInstanceHandle(internalInstanceHandle) {
  if (isReactNativeRuntime()) {
    const renderer = getReactNativeRendererProxy()
    return renderer.getPublicInstanceFromInternalInstanceHandle(
      internalInstanceHandle
    )
  }

  const stateNode = internalInstanceHandle?.stateNode
  if (stateNode == null) {
    return null
  }

  if (stateNode.canonical?.publicInstance != null) {
    return stateNode.canonical.publicInstance
  }

  return stateNode.node ?? stateNode
}

function getPublicInstanceFromRootTag(rootTag) {
  if (isReactNativeRuntime()) {
    const renderer = getReactNativeRendererProxy()
    return renderer.getPublicInstanceFromRootTag(rootTag)
  }

  if (global.rootInstance?.containerTag === Number(rootTag)) {
    return global.rootInstance.publicInstance ?? null
  }

  return null
}

function dispatchCommand(handle, command, args) {
  if (isReactNativeRuntime()) {
    const renderer = getReactNativeRendererProxy()
    renderer.dispatchCommand(handle, command, args)
    return
  }

  // Public refs resolve through the runtime-local fiber, including after cloning a native node.
  const publicInstances = require('react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance')
  const node = publicInstances.getNodeFromPublicInstance(handle)
  if (node == null) {
    return
  }

  global.nativeFabricUIManager.dispatchCommand(node, command, args)
}

function findNodeHandle(handle) {
  if (isReactNativeRuntime()) {
    const renderer = getReactNativeRendererProxy()
    return renderer.findNodeHandle(handle)
  }

  if (handle == null) {
    return null
  }
  if (typeof handle === 'number') {
    return handle
  }

  const publicInstances = require('react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactFabricPublicInstance')
  return publicInstances.getNativeTagFromPublicInstance(handle)
}

module.exports = {
  dispatchCommand,
  findNodeHandle,
  getNodeFromInternalInstanceHandle,
  getPublicInstanceFromInternalInstanceHandle,
  getPublicInstanceFromRootTag,
}
