package com.hannojg.list.runtimetests;

import com.facebook.jni.HybridData;
import com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

public final class FixtureTurboModuleManagerDelegate extends TurboModuleManagerDelegate {
  public FixtureTurboModuleManagerDelegate() {
    super(initHybridForTests());
  }

  private static native HybridData initHybridForTests();

  @Override
  protected HybridData initHybrid() {
    return initHybridForTests();
  }

  @Override
  public TurboModule getModule(String name) {
    return null;
  }

  @Override
  public boolean unstable_isModuleRegistered(String name) {
    return false;
  }
}
