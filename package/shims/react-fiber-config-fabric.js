const ReactNativePrivateInterface = require('react-native/Libraries/ReactPrivate/ReactNativePrivateInterface')

function getPublicInstance(instance) {
  if (instance?.canonical != null) {
    if (instance.canonical.publicInstance == null) {
      instance.canonical.publicInstance =
        ReactNativePrivateInterface.createPublicInstance(
          instance.canonical.nativeTag,
          instance.canonical.viewConfig,
          instance.canonical.internalInstanceHandle,
          // TODO: this might need to be passed through createPublicRootInstance/createReactNativeDocument
          instance.canonical.publicRootInstance ?? null
        )
      instance.canonical.publicRootInstance = null
    }
    return instance.canonical.publicInstance
  }

  if (instance?.containerInfo?.publicInstance != null) {
    return instance.containerInfo.publicInstance
  }

  if (instance?._nativeTag != null) {
    return instance
  }

  return null
}

module.exports = {
  getPublicInstance,
}
