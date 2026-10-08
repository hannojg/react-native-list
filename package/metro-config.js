'use strict'

const path = require('path')

const rendererProxyThreadSwitchPath = path.resolve(
  __dirname,
  'metro/RendererProxyThreadSwitch.js'
)

function isRendererProxyImport(moduleName) {
  return /(?:^|\/)RendererProxy(?:\.js)?$/.test(moduleName)
}

//#region Turbo module handling
// react-native-worklets installs a shim preventing the usage of TurboModules on other runtimes:
// - https://github.com/software-mansion/react-native-reanimated/blob/9c2e3b05216b22d3c1ed4be67719876d1fa9115d/packages/react-native-worklets/bundleMode/shims/turboModuleRegistryShim.js#L36
// As we properly handle turbo modules we want to allow for it.
// So we basically redirect all imports of the shim back to the original TurboModuleRegistry.js file:
const turboModuleRegistryModuleName =
  'react-native/Libraries/TurboModule/TurboModuleRegistry'
const turboModuleRegistryPath = require.resolve(turboModuleRegistryModuleName)
const turboModuleRegistryFileSuffix = path.join(
  'react-native',
  'Libraries',
  'TurboModule',
  'TurboModuleRegistry.js'
)
const workletsTurboModuleRegistryShimSuffix = path.join(
  'react-native-worklets',
  'bundleMode',
  'shims',
  'turboModuleRegistryShim.js'
)

function isTurboModuleRegistryImport(moduleName) {
  return moduleName === turboModuleRegistryModuleName
}

function isSourceFileResolution(result) {
  if (result == null) {
    return false
  }

  if (result.type !== 'sourceFile') {
    return false
  }

  return typeof result.filePath === 'string'
}

function isTurboModuleRegistryResolution(result) {
  if (!isSourceFileResolution(result)) {
    return false
  }

  return result.filePath.endsWith(turboModuleRegistryFileSuffix)
}

function isWorkletsTurboModuleRegistryShimResolution(result) {
  if (!isSourceFileResolution(result)) {
    return false
  }

  return result.filePath.endsWith(workletsTurboModuleRegistryShimSuffix)
}

function createTurboModuleRegistryResolution() {
  return {
    type: 'sourceFile',
    filePath: turboModuleRegistryPath,
  }
}
//#endregion

function isReactNativeRendererConsumer(originModulePath) {
  if (typeof originModulePath !== 'string') {
    return false
  }

  const isDomInternals = originModulePath.includes(
    `${path.sep}node_modules${path.sep}react-native${path.sep}src${path.sep}private${path.sep}webapis${path.sep}dom${path.sep}nodes${path.sep}internals${path.sep}`
  )
  const nativeCommandsPath = path.join(
    'react-native',
    'Libraries',
    'Utilities',
    'codegenNativeCommands.js'
  )
  const isNativeCommands = originModulePath.endsWith(nativeCommandsPath)
  const publicInstancePath = path.join(
    'react-native',
    'Libraries',
    'ReactNative',
    'ReactFabricPublicInstance',
    'ReactFabricPublicInstance.js'
  )
  const isPublicInstance = originModulePath.endsWith(publicInstancePath)
  const textInputStatePath = path.join(
    'react-native',
    'Libraries',
    'Components',
    'TextInput',
    'TextInputState.js'
  )
  const isTextInputState = originModulePath.endsWith(textInputStatePath)

  return (
    isDomInternals || isNativeCommands || isPublicInstance || isTextInputState
  )
}

function getReactNativeListMetroConfig(config) {
  config.resolver = config.resolver || {}
  const currentResolveRequest = config.resolver.resolveRequest

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (isTurboModuleRegistryImport(moduleName)) {
      return createTurboModuleRegistryResolution()
    }

    // Components and refs must not initialize RN's main renderer inside a worklet runtime.
    if (
      isRendererProxyImport(moduleName) &&
      isReactNativeRendererConsumer(context.originModulePath)
    ) {
      return {
        type: 'sourceFile',
        filePath: rendererProxyThreadSwitchPath,
      }
    }

    const resolveRequest = currentResolveRequest || context.resolveRequest
    const resolved = resolveRequest(context, moduleName, platform)

    if (isTurboModuleRegistryResolution(resolved)) {
      return createTurboModuleRegistryResolution()
    }

    if (isWorkletsTurboModuleRegistryShimResolution(resolved)) {
      return createTurboModuleRegistryResolution()
    }

    return resolved
  }

  return config
}

module.exports = {
  getReactNativeListMetroConfig,
}
