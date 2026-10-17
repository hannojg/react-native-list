package com.margelo.nitro.reactnativelist;

import androidx.annotation.Keep;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.fabric.mounting.MountingManager;
import com.facebook.react.fabric.mounting.mountitems.MountItem;
import java.lang.ref.WeakReference;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.Queue;

/**
 * Makes a list holder's native views available before its synchronous render returns.
 *
 * <p>Each holder owns a separate Fabric surface. RecyclerView can request a holder while
 * Fabric is mounting the app surface. Although our UI-runtime React commit is synchronous,
 * Fabric's dispatcher refuses to reenter and leaves the holder's native mutations queued.
 * The list cannot measure or resolve those views until the mutations have executed.
 *
 * <p>Install one adapter per FabricUIManager before creating holder surfaces, then register
 * each holder with that adapter. The adapter wraps RN's regular and preallocation queues;
 * SurfaceMountingQueue records pending work for registered surfaces only. After a holder
 * commits, flushSurface executes that surface's recorded work without draining app work or
 * resetting the dispatcher's global inDispatch guard. View commands stay on RN's normal
 * dispatch/retry path; this is not a synchronous command-flushing API.
 *
 * <p>Installation, surface ownership, and flushing run on the UI thread. Queue producers
 * may run on other threads; the shared ledger synchronizes their bookkeeping. Surface IDs
 * route flushes back to the manager that created them, including across React instances.
 *
 * <p>RN exposes no public surface-scoped flush API. Reflection is isolated here and depends
 * on the private field layout validated with RN 0.86.2. consumer-rules.pro preserves the
 * reflected fields in minified apps. Missing fields fail installation rather than leave
 * views silently unmounted. RN upgrades require the native tests and app smoke checks
 * documented in native-tests/README.md.
 */
@Keep
public final class SurfaceMounting extends SurfaceMountingQueue.Ledger {
  private static final Map<Integer, WeakReference<SurfaceMounting>> surfaces = new HashMap<>();
  private final MountingManager mountingManager;

  private SurfaceMounting(Object dispatcher, MountingManager mountingManager) throws ReflectiveOperationException {
    this.mountingManager = mountingManager;
    wrapQueues(dispatcher);
  }

  public static SurfaceMounting install(FabricUIManager manager) {
    UiThreadUtil.assertOnUiThread();
    try {
      Field dispatcherField = FabricUIManager.class.getDeclaredField("mMountItemDispatcher");
      dispatcherField.setAccessible(true);
      Object dispatcher = dispatcherField.get(manager);
      Class<?> dispatcherClass = dispatcher.getClass();
      Field queueField = dispatcherClass.getDeclaredField("mountItems");
      queueField.setAccessible(true);
      Object installedQueue = queueField.get(dispatcher);
      if (installedQueue instanceof SurfaceMountingQueue) {
        SurfaceMountingQueue queue = (SurfaceMountingQueue) installedQueue;
        return (SurfaceMounting) queue.getLedger();
      }
      Field managerField = FabricUIManager.class.getDeclaredField("mMountingManager");
      managerField.setAccessible(true);
      MountingManager mountingManager = (MountingManager) managerField.get(manager);
      SurfaceMounting adapter = new SurfaceMounting(dispatcher, mountingManager);
      return adapter;
    } catch (ReflectiveOperationException error) {
      throw new IllegalStateException("Unsupported Fabric mounting internals for holder surfaces.", error);
    }
  }

  @SuppressWarnings("unchecked")
  private void wrapQueues(Object dispatcher) throws ReflectiveOperationException {
    Class<?> dispatcherClass = dispatcher.getClass();
    Field mountField = dispatcherClass.getDeclaredField("mountItems");
    Field preMountField = dispatcherClass.getDeclaredField("preMountItems");
    mountField.setAccessible(true);
    preMountField.setAccessible(true);
    Queue<MountItem> mounts = (Queue<MountItem>) mountField.get(dispatcher);
    Queue<MountItem> preMounts = (Queue<MountItem>) preMountField.get(dispatcher);
    // Preserve work already queued before installation. Install before starting holder
    // surfaces: only offers through the wrapper can be tracked for an early flush.
    SurfaceMountingQueue mountQueue = new SurfaceMountingQueue(mounts, this);
    SurfaceMountingQueue preMountQueue = new SurfaceMountingQueue(preMounts, this);
    mountField.set(dispatcher, mountQueue);
    try {
      preMountField.set(dispatcher, preMountQueue);
    } catch (IllegalAccessException error) {
      mountField.set(dispatcher, mounts);
      throw error;
    }
  }

  void registerSurface(int surfaceId) {
    UiThreadUtil.assertOnUiThread();
    register(surfaceId);
    WeakReference<SurfaceMounting> reference = new WeakReference<>(this);
    surfaces.put(surfaceId, reference);
  }

  void unregisterSurface(int surfaceId) {
    UiThreadUtil.assertOnUiThread();
    unregister(surfaceId);
    surfaces.remove(surfaceId);
  }

  @Keep
  public static void flushSurface(int surfaceId) {
    UiThreadUtil.assertOnUiThread();
    WeakReference<SurfaceMounting> reference = surfaces.get(surfaceId);
    SurfaceMounting adapter = reference != null ? reference.get() : null;
    if (adapter == null) {
      throw new IllegalStateException("No mounting adapter for holder surface: " + surfaceId);
    }
    adapter.flush(surfaceId, adapter.mountingManager);
  }
}
