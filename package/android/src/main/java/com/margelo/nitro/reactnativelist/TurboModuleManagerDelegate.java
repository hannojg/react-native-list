package com.margelo.nitro.reactnativelist;

import com.facebook.jni.HybridData;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.internal.turbomodule.core.TurboModuleManager;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

// Creates runtime-local wrappers while leaving native module ownership with the root manager.
@DoNotStrip
public final class TurboModuleManagerDelegate extends com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate {
  private final TurboModuleManager rootManager;
  private final com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate rootDelegate;

  public TurboModuleManagerDelegate(
      TurboModuleManager rootManager,
      com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate rootDelegate) {
    super(initHybrid(rootDelegate));
    this.rootManager = rootManager;
    this.rootDelegate = rootDelegate;
  }

  @Override
  protected HybridData initHybrid() {
    throw new IllegalStateException("Use the injected root delegate constructor.");
  }

  @DoNotStrip
  private static native HybridData initHybrid(
      com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate rootDelegate);

  @Override
  public TurboModule getModule(String name) {
    if (!rootDelegate.unstable_isModuleRegistered(name)) {
      return null;
    }
    NativeModule module = rootManager.getModule(name);
    if (module == null) {
      return null;
    }
    return new BorrowedModule(module);
  }

  @Override
  public boolean unstable_isModuleRegistered(String name) {
    return rootDelegate.unstable_isModuleRegistered(name);
  }
}
