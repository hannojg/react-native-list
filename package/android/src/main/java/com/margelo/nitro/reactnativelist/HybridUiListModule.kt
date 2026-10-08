package com.margelo.nitro.reactnativelist

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.RuntimeExecutor
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.annotations.FrameworkAPI
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.fabric.FabricUIManager
import com.facebook.react.internal.turbomodule.core.TurboModuleManager
import com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate as ReactTurboModuleManagerDelegate
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import com.facebook.react.turbomodule.core.interfaces.NativeMethodCallInvokerHolder
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.margelo.nitro.NitroModules
import com.swmansion.worklets.WorkletsModule
import kotlin.concurrent.Volatile

@DoNotStrip
@Keep
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

        val workletsModule = context.getNativeModule(WorkletsModule::class.java)
            ?: throw IllegalStateException("WorkletsModule is null! Is the WorkletsModule properly registered?")
        val nativeModuleProxyInstalled = prepareUiRuntime(workletsModule)

        if (!nativeModuleProxyInstalled) {
            // Runtime setup can happen before ReactApplicationContext has an attached Activity.
            val application = context.applicationContext as? ReactApplication
                ?: throw IllegalStateException("Application is not a ReactApplication!")
            val reactHost = application.reactHost
                ?: throw IllegalStateException("ReactHost is null!")

            // Next: Create a TurboModuleManager for the UI runtime, which will set global.nativeModuleProxy
            // This is whats being used when doing NativeModule.MyNativeModule in JS!
            // TODO: i use a bunch of internals here, can this be improved?
            val reactHostImpl = reactHost as? ReactHostImpl
                ?: throw IllegalStateException("ReactHost is not a ReactHostImpl! Is the New Architecture enabled?")

            // Get nativeMethodCallInvokerHolder from reactInstance, which lives on reactHostImpl
            val reactInstanceField = reactHostImpl.javaClass.getDeclaredField("reactInstance")
            reactInstanceField.isAccessible = true
            val reactInstance = reactInstanceField.get(reactHostImpl)
                ?: throw IllegalStateException("ReactInstance is null! Is the New Architecture enabled?")
            val getNativeMethodCallInvokerHolderMethod = reactInstance.javaClass.getDeclaredMethod("getNativeMethodCallInvokerHolder")
            getNativeMethodCallInvokerHolderMethod.isAccessible = true
            val nativeMethodCallInvokerHolder = getNativeMethodCallInvokerHolderMethod.invoke(reactInstance) as? NativeMethodCallInvokerHolder
                ?: throw IllegalStateException("NativeMethodCallInvokerHolder is null! Is the New Architecture enabled?")

            val rootManagerField = reactInstance.javaClass.getDeclaredField("turboModuleManager")
            rootManagerField.isAccessible = true
            val rootManager = rootManagerField.get(reactInstance) as? TurboModuleManager
                ?: throw IllegalStateException("Root TurboModuleManager is null!")
            val rootDelegateField = rootManager.javaClass.getDeclaredField("delegate")
            rootDelegateField.isAccessible = true
            val rootDelegate = rootDelegateField.get(rootManager) as? ReactTurboModuleManagerDelegate
                ?: throw IllegalStateException("Root TurboModuleManagerDelegate is null!")
            val turboModuleManagerDelegate = TurboModuleManagerDelegate(rootManager, rootDelegate)

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
        }

        val uiManager = UIManagerHelper.getUIManager(context, UIManagerType.FABRIC)
            ?: throw IllegalStateException("Fabric UIManager is null! Is the Fabric architecture enabled?")
        val fabricUIManager = uiManager as? FabricUIManager
            ?: throw IllegalStateException("UIManager is not a FabricUIManager! Is the Fabric architecture enabled?")
        setupEventInterceptor(fabricUIManager)
    }

    @OptIn(FrameworkAPI::class)
    private external fun prepareUiRuntime(workletsModule: WorkletsModule): Boolean

    @OptIn(FrameworkAPI::class)
    private external fun getUiCallInvokerHolder(workletsModule: WorkletsModule): CallInvokerHolderImpl

    private external fun getUiRuntimeExecutor(workletsModule: WorkletsModule): RuntimeExecutor

    private external fun setupEventInterceptor(fabricUIManager: FabricUIManager)

    @Volatile
    private lateinit var uiTurboModuleManager: TurboModuleManager
}
