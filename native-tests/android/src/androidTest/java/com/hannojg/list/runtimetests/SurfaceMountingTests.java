package com.hannojg.list.runtimetests;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.facebook.react.fabric.mounting.MountItemDispatcher;
import com.facebook.react.fabric.mounting.MountingManager;
import com.facebook.react.fabric.mounting.mountitems.MountItem;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.uimanager.ViewManagerRegistry;
import com.facebook.soloader.SoLoader;
import com.margelo.nitro.reactnativelist.SurfaceMountingQueue;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Queue;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class SurfaceMountingTests {
  @BeforeClass
  public static void loadReactNative() throws Exception {
    var instrumentation = InstrumentationRegistry.getInstrumentation();
    var context = instrumentation.getTargetContext();
    SoLoader.init(context, OpenSourceMergedSoMapping.INSTANCE);
    SoLoader.loadLibrary("reactnativejni");
  }

  private static void onMain(Runnable action) {
    var instrumentation = InstrumentationRegistry.getInstrumentation();
    instrumentation.runOnMainSync(action);
  }

  private static MountItem item(int surfaceId, Runnable action) {
    return new MountItem() {
      @Override public int getSurfaceId() { return surfaceId; }
      @Override public void execute(MountingManager manager) { action.run(); }
    };
  }

  private static final class Fixture implements MountItemDispatcher.ItemDispatchListener {
    final SurfaceMountingQueue.Ledger ledger = new SurfaceMountingQueue.Ledger();
    final MountingManager manager;
    final MountItemDispatcher dispatcher;
    final List<String> events = new ArrayList<>();
    final List<Integer> reportedSurfaces = new ArrayList<>();

    Fixture() {
      List<ViewManager<?, ?>> viewManagers = Collections.emptyList();
      var registry = new ViewManagerRegistry(viewManagers);
      manager = new MountingManager(registry, items -> {
        while (!items.isEmpty()) {
          MountItem next = items.remove();
          MountingManager executionManager = managerForExecution();
          next.execute(executionManager);
        }
      });
      dispatcher = new MountItemDispatcher(manager, this);
      ledger.register(21);
      ledger.register(31);
      wrap("mountItems");
      wrap("preMountItems");
    }

    private MountingManager managerForExecution() { return manager; }

    @SuppressWarnings("unchecked")
    private void wrap(String name) {
      try {
        Field field = MountItemDispatcher.class.getDeclaredField(name);
        field.setAccessible(true);
        Queue<MountItem> queue = (Queue<MountItem>) field.get(dispatcher);
        SurfaceMountingQueue trackedQueue = new SurfaceMountingQueue(queue, ledger);
        field.set(dispatcher, trackedQueue);
      } catch (ReflectiveOperationException error) {
        throw new AssertionError(error);
      }
    }

    @Override public void willMountItems(List<? extends MountItem> items) {}
    @Override public void didDispatchMountItems() {}
    @Override public void didMountItems(List<? extends MountItem> items) {
      if (items == null) return;
      for (MountItem item : items) {
        int surfaceId = item.getSurfaceId();
        reportedSurfaces.add(surfaceId);
      }
    }

    void add(int surfaceId, String event) {
      addAction(surfaceId, () -> events.add(event));
    }

    void addAction(int surfaceId, Runnable action) {
      MountItem mountItem = item(surfaceId, action);
      dispatcher.addMountItem(mountItem);
    }

    void assertEvents(String... expected) {
      List<String> expectedEvents = Arrays.asList(expected);
      assertEquals(expectedEvents, events);
    }

    void assertDispatcherStillMounting() {
      try {
        Field field = MountItemDispatcher.class.getDeclaredField("inDispatch");
        field.setAccessible(true);
        boolean mounting = field.getBoolean(dispatcher);
        assertTrue(mounting);
      } catch (ReflectiveOperationException error) {
        throw new AssertionError(error);
      }
    }
  }

  @Test public void nestedFlushLeavesOtherSurfacesAndGlobalGuardUntouched() {
    onMain(() -> {
      Fixture fixture = new Fixture();
      fixture.addAction(11, () -> {
        fixture.events.add("outer-start");
        fixture.add(21, "holder");
        fixture.add(11, "app");
        fixture.add(31, "other-holder");
        fixture.dispatcher.tryDispatchMountItems();
        fixture.ledger.flush(21, fixture.manager);
        fixture.assertDispatcherStillMounting();
        fixture.assertEvents("outer-start", "holder");
        fixture.events.add("outer-end");
      });
      fixture.dispatcher.tryDispatchMountItems();
      fixture.dispatcher.tryDispatchMountItems();
      fixture.assertEvents("outer-start", "holder", "outer-end", "app", "other-holder");
      boolean reportedHolder = fixture.reportedSurfaces.contains(21);
      assertTrue(reportedHolder);
    });
  }

  @Test public void flushIncludesOlderBatchAlreadyDrainedIntoOuterLocalList() {
    onMain(() -> {
      Fixture fixture = new Fixture();
      fixture.addAction(11, () -> {
        fixture.add(21, "newer");
        fixture.ledger.flush(21, fixture.manager);
        fixture.assertEvents("older", "newer");
      });
      fixture.add(21, "older");
      fixture.dispatcher.tryDispatchMountItems();
      fixture.dispatcher.tryDispatchMountItems();
      fixture.assertEvents("older", "newer");
    });
  }

  @Test public void preallocationRunsBeforeItsBatchAndOnlyOnce() {
    onMain(() -> {
      Fixture fixture = new Fixture();
      fixture.addAction(11, () -> {
        MountItem allocate = item(21, () -> fixture.events.add("allocate"));
        fixture.dispatcher.addPreAllocateMountItem(allocate);
        fixture.add(21, "create");
        fixture.ledger.flush(21, fixture.manager);
        fixture.assertEvents("allocate", "create");
      });
      fixture.dispatcher.tryDispatchMountItems();
      fixture.dispatcher.tryDispatchMountItems();
      fixture.assertEvents("allocate", "create");
    });
  }

  @Test public void retiredSurfaceCannotReplayDrainedTickets() {
    onMain(() -> {
      Fixture fixture = new Fixture();
      fixture.addAction(11, () -> fixture.ledger.unregister(21));
      fixture.add(21, "retired");
      fixture.dispatcher.tryDispatchMountItems();
      fixture.assertEvents();
      assertThrows(IllegalStateException.class, () -> fixture.ledger.flush(21, fixture.manager));
    });
  }

  @Test public void sameSurfaceReentrancyFailsInsteadOfReorderingMutations() {
    onMain(() -> {
      Fixture fixture = new Fixture();
      fixture.addAction(21, () -> {
        fixture.add(21, "nested");
        var error = assertThrows(IllegalStateException.class, () -> fixture.ledger.flush(21, fixture.manager));
        String message = error.getMessage();
        boolean rejectedReentry = message.contains("Cannot reenter mounting");
        assertTrue(rejectedReentry);
      });
      fixture.ledger.flush(21, fixture.manager);
      fixture.dispatcher.tryDispatchMountItems();
      fixture.assertEvents("nested");
    });
  }

  @Test public void throwingBatchIsNotReplayedAndDoesNotLeaveSurfaceActive() {
    onMain(() -> {
      Fixture fixture = new Fixture();
      fixture.addAction(21, () -> {
        fixture.events.add("failed");
        throw new IllegalStateException("fixture mount failure");
      });
      assertThrows(IllegalStateException.class, () -> fixture.ledger.flush(21, fixture.manager));
      fixture.add(21, "next");
      fixture.ledger.flush(21, fixture.manager);
      fixture.dispatcher.tryDispatchMountItems();
      fixture.assertEvents("failed", "next");
    });
  }
}
