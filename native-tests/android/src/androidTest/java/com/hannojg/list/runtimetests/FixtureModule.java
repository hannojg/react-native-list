package com.hannojg.list.runtimetests;

import com.facebook.react.bridge.BaseJavaModule;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.turbomodule.core.interfaces.TurboModule;

public final class FixtureModule extends BaseJavaModule implements TurboModule {
  private double counter;

  @Override
  public String getName() { return "ListTestNativeModule"; }

  public double increment() { return ++counter; }
  public void callback(Callback callback) { callback.invoke(42); }
  public void promise(Promise promise) { promise.resolve(43); }
  public void emit() { mEventEmitterCallback.invoke("onChanged", 1); }
}
