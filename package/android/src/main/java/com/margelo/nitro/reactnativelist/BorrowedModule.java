package com.margelo.nitro.reactnativelist;

import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.BaseJavaModule;
import com.facebook.react.bridge.CxxCallbackImpl;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

// A manager-owned adapter that shields the shared native instance from a second runtime's
// initialization, event callback replacement, and teardown.
@DoNotStrip
public final class BorrowedModule extends BaseJavaModule implements TurboModule {
  private final NativeModule nativeModule;

  public BorrowedModule(NativeModule nativeModule) {
    this.nativeModule = nativeModule;
  }

  @Override
  public String getName() {
    return nativeModule.getName();
  }

  @DoNotStrip
  public NativeModule getNativeModule() {
    return nativeModule;
  }

  // The generated metadata wrapper must not replace the root's event callback.
  @Override
  protected void setEventEmitterCallback(CxxCallbackImpl callback) {}

  @Override
  public void initialize() {}

  @Override
  public void invalidate() {}
}
