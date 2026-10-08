package com.hannojg.list.runtimetests;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.soloader.SoLoader;
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.fail;
import com.margelo.nitro.reactnativelist.BorrowedModule;
import com.margelo.nitro.reactnativelist.TurboModuleManagerDelegate;

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
  private static native void runCppScenario(
      com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate root,
      com.facebook.react.internal.turbomodule.core.TurboModuleManagerDelegate ui);

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

  @Test
  public void rootEventsSurviveUiRuntimeTeardown() {
    var module = new FixtureModule();
    runScenario(5, module, module);
  }

  @Test
  public void uiWrapperCanBeCreatedBeforeRootWrapper() {
    var module = new FixtureModule();
    runScenario(6, module, module);
  }

  @Test
  public void borrowedModuleDoesNotOwnNativeLifecycle() {
    var module = new FixtureModule();
    module.initialize();
    var borrowed = new BorrowedModule(module);
    boolean installsBindings = TurboModuleWithJSIBindings.class.isInstance(borrowed);
    assertFalse(installsBindings);
    borrowed.initialize();
    borrowed.invalidate();
    assertEquals(1, module.initializations);
    assertEquals(0, module.invalidations);
    module.invalidate();
    assertEquals(1, module.invalidations);
  }

  @Test
  public void handwrittenCppStateSharingIsExpectedFailure() {
    var rootDelegate = new FixtureTurboModuleManagerDelegate();
    // Pure C++ lookup does not use the Java native-module manager.
    var uiDelegate = new TurboModuleManagerDelegate(null, rootDelegate);
    try {
      runCppScenario(rootDelegate, uiDelegate);
    } catch (RuntimeException error) {
      assertEquals("native.increment() did not equal 2.000000", error.getMessage());
      return;
    }
    fail("Handwritten C++ sharing now passes; remove the expected failure.");
  }
}
