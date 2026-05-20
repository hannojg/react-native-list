package com.margelo.nitro.reactnativelist

import com.facebook.react.ReactActivity
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.RuntimeExecutor
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.annotations.FrameworkAPI
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.fabric.FabricUIManager
import com.facebook.react.internal.turbomodule.core.TurboModuleManager
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.facebook.react.runtime.ReactHostDelegate
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import com.facebook.react.turbomodule.core.interfaces.NativeMethodCallInvokerHolder
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.margelo.nitro.NitroModules
import com.swmansion.worklets.WorkletsModule
import java.util.ArrayList
import kotlin.concurrent.Volatile

class HybridUiListModule : HybridUiListModuleSpec() {
    override fun iosGetWorkletsModule(): HybridIOSWorkletsModuleProxyHolderSpec {
        throw IllegalStateException("iosGetWorkletsModule is iOS-only and must not be called on Android.")
    }

    @OptIn(UnstableReactNativeAPI::class, FrameworkAPI::class)
    override fun setupRuntime(workletsModuleHolder: Variant_NullType_HybridIOSWorkletsModuleProxyHolderSpec?) {
        if (!UiThreadUtil.isOnUiThread()) {
            throw IllegalStateException("setupRuntime must be called on the UI thread!")
        }

        val context: ReactApplicationContext = NitroModules.applicationContext
            ?: throw IllegalStateException("ReactApplicationContext is null! Is Nitro installed?")

        val uiManager = UIManagerHelper.getUIManager(context, UIManagerType.FABRIC)
            ?: throw IllegalStateException("Fabric UIManager is null! Is the Fabric architecture enabled?")
        val reactActivity = context.currentActivity as? ReactActivity
            ?: throw IllegalStateException("Current activity is not a ReactActivity!")
        val reactHost = reactActivity.reactActivityDelegate.reactHost
            ?: throw IllegalStateException("ReactNativeHost is null!")

        // Next: Create a TurboModuleManager for the UI runtime, which will set global.nativeModuleProxy
        // This is whats being used when doing NativeModule.MyNativeModule in JS!
        // TODO: i use a bunch of internals here, can this be improved?

        val workletsModule = context.getNativeModule(WorkletsModule::class.java)
            ?: throw IllegalStateException("WorkletsModule is null! Is the WorkletsModule properly registered?")
        prepareUiRuntime(workletsModule)

        val reactHostImpl = reactHost as? ReactHostImpl
            ?: throw IllegalStateException("ReactHost is not a ReactHostImpl! Is the New Architecture enabled?")

        val reactHostDelegateField = reactHostImpl.javaClass.getDeclaredField("reactHostDelegate")
        reactHostDelegateField.isAccessible = true
        val reactHostDelegate = reactHostDelegateField.get(reactHostImpl) as? ReactHostDelegate
            ?: throw IllegalStateException("ReactHostDelegate is null! Is the New Architecture enabled?")

        // Get nativeMethodCallInvokerHolder from reactInstance, which lives on reactHostImpl
        val reactInstanceField = reactHostImpl.javaClass.getDeclaredField("reactInstance")
        reactInstanceField.isAccessible = true
        val reactInstance = reactInstanceField.get(reactHostImpl)
            ?: throw IllegalStateException("ReactInstance is null! Is the New Architecture enabled?")
        val getNativeMethodCallInvokerHolderMethod = reactInstance.javaClass.getDeclaredMethod("getNativeMethodCallInvokerHolder")
        getNativeMethodCallInvokerHolderMethod.isAccessible = true
        val nativeMethodCallInvokerHolder = getNativeMethodCallInvokerHolderMethod.invoke(reactInstance) as? NativeMethodCallInvokerHolder
            ?: throw IllegalStateException("NativeMethodCallInvokerHolder is null! Is the New Architecture enabled?")

        val reactPackages: MutableList<ReactPackage> = ArrayList<ReactPackage>()
        val coreReactPackageClass = Class.forName("com.facebook.react.runtime.CoreReactPackage")
        val constructor = coreReactPackageClass.declaredConstructors.first()
        constructor.isAccessible = true
        // TODO: this will create dev support modules on the UI runtime which is unnecessary overhead we don't need!
        //       In a past version i simply put in the most important core modules from JS, which was somewhat nicer.
        val coreReactPackage = constructor.newInstance(reactHost.devSupportManager, DefaultHardwareBackBtnHandler {}) as ReactPackage
        reactPackages.add(coreReactPackage)
        reactPackages.addAll(reactHostDelegate.reactPackages)

        val turboModuleManagerDelegate = reactHostDelegate.turboModuleManagerDelegateBuilder
            .setPackages(reactPackages)
            .setReactApplicationContext(context)
            .build()

        val uiCallInvokerHolder = getUiCallInvokerHolder(workletsModule)
        val uiRuntimeExecutor = getUiRuntimeExecutor(workletsModule)

        // This will install the JSI bindings
        uiTurboModuleManager = TurboModuleManager(
            // TurboModuleManager will call jni -> cpp, to actually setup nativeModuleProxy
            runtimeExecutor = uiRuntimeExecutor,
            delegate = turboModuleManagerDelegate,
            jsCallInvokerHolder = uiCallInvokerHolder,
            nativeMethodCallInvokerHolder = nativeMethodCallInvokerHolder
        )

        val fabricUIManager = uiManager as? FabricUIManager
            ?: throw IllegalStateException("UIManager is not a FabricUIManager! Is the Fabric architecture enabled?")
        setupEventInterceptor(fabricUIManager)

        android.util.Log.d("HannoDebug", "✅✅✅✅ UI runtime setup complete!")
    }

    @OptIn(FrameworkAPI::class)
    private external fun prepareUiRuntime(workletsModule: WorkletsModule)

    @OptIn(FrameworkAPI::class)
    private external fun getUiCallInvokerHolder(workletsModule: WorkletsModule): CallInvokerHolderImpl

    private external fun getUiRuntimeExecutor(workletsModule: WorkletsModule): RuntimeExecutor

    private external fun setupEventInterceptor(fabricUIManager: FabricUIManager)

    @Volatile
    private lateinit var uiTurboModuleManager: TurboModuleManager
}
