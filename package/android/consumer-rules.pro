# The runtime installer borrows the root manager through these RN instance fields.
# RN keeps the classes, but these private fields do not have @DoNotStrip.
-keepclassmembers class com.facebook.react.runtime.ReactHostImpl {
    com.facebook.react.runtime.ReactInstance reactInstance;
}
-keepclassmembers class com.facebook.react.runtime.ReactInstance {
    com.facebook.react.internal.turbomodule.core.TurboModuleManager turboModuleManager;
}

# SurfaceMounting wraps these queues by field name before starting holder surfaces.
-keepclassmembers class com.facebook.react.fabric.mounting.MountItemDispatcher {
    java.util.Queue mountItems;
    java.util.Queue preMountItems;
}
