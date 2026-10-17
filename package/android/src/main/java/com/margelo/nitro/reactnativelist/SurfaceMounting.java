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
 * Prototype of a Fabric flushSurface(surfaceId) API. Private access is confined
 * here; neither Fabric's global reentrancy flag nor unrelated queues are flushed.
 * The adapter must be installed before the first holder surface is registered.
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
    // Keep the original backing queue: a producer already holding its reference
    // can still enqueue unrelated work during installation without losing it.
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
