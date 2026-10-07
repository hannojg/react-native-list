package com.hannojg.list.runtimetests;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.soloader.SoLoader;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class NativeRuntimeTests {
  @BeforeClass
  public static void loadLibraries() throws Exception {
    var instrumentation = InstrumentationRegistry.getInstrumentation();
    var context = instrumentation.getTargetContext();
    SoLoader.init(context, OpenSourceMergedSoMapping.INSTANCE);
    SoLoader.loadLibrary("reactnativejni");
    SoLoader.loadLibrary("turbomodulejsijni");
    System.loadLibrary("ListRuntimeTests");
  }

  private static native void runScenario(int scenario, FixtureModule root, FixtureModule ui);

  @Test
  public void twoWrappersShareNativeState() {
    var module = new FixtureModule();
    runScenario(0, module, module);
  }

  @Test
  public void callbacksAndPromisesStayInTheirRuntime() {
    var module = new FixtureModule();
    runScenario(1, module, module);
  }

  @Test
  public void separateInstancesKeepRootEventCallback() {
    var root = new FixtureModule();
    var ui = new FixtureModule();
    runScenario(2, root, ui);
  }

  @Test
  public void sharedInstanceKeepsRootEventCallback() {
    var module = new FixtureModule();
    runScenario(3, module, module);
  }
}
