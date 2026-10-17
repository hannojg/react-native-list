package com.margelo.nitro.reactnativelist;

import com.facebook.react.fabric.mounting.MountingManager;
import com.facebook.react.fabric.mounting.mountitems.DispatchCommandMountItem;
import com.facebook.react.fabric.mounting.mountitems.MountItem;
import java.util.AbstractQueue;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

/**
 * Gives SurfaceMounting a surface-specific view of RN's pending native mutations.
 *
 * <p>RN removes items from its shared queue into a local batch before executing them.
 * A holder render can happen partway through that batch, so searching the shared queue
 * during the render would miss older mutations for the same holder. Instead, offer wraps
 * each registered surface's item in a ticket and records it in a per-surface ledger.
 * Polling a ticket out of RN's queue does not remove it from the ledger.
 *
 * <p>Both RN's normal dispatch and an explicit surface flush execute through that ledger.
 * Reaching a ticket first executes any earlier tickets for its surface, including pending
 * preallocations from the other wrapped queue. Each ticket releases its mutation before
 * executing it, so the original ticket becomes a no-op if RN encounters it again. Leaving
 * tickets in RN's batches preserves its later completion/report-mount notifications;
 * those notifications are not brought forward with the native mutations.
 *
 * <p>The regular and preallocation queues must share one ledger. Its monitor protects
 * ordering against background producers, but is released before native mutations execute.
 * Nested mounting of another surface is allowed; pending work on the actively mounting
 * surface is rejected to avoid interleaving mutations within that surface's current batch.
 */
public final class SurfaceMountingQueue extends AbstractQueue<MountItem> {
  private final Queue<MountItem> delegate;
  private final Ledger ledger;

  public SurfaceMountingQueue(Queue<MountItem> delegate, Ledger ledger) {
    this.delegate = delegate;
    this.ledger = ledger;
  }

  Ledger getLedger() { return ledger; }

  @Override
  public boolean offer(MountItem item) {
    synchronized (ledger) {
      int surfaceId = item.getSurfaceId();
      ArrayDeque<Ticket> pending = ledger.surfaces.get(surfaceId);
      // RN recognizes commands by their concrete type to implement retries. They
      // remain on RN's normal path, rather than hiding that type behind a ticket.
      if (pending == null || item instanceof DispatchCommandMountItem) {
        return delegate.offer(item);
      }
      Ticket ticket = new Ticket(item, surfaceId, ledger);
      pending.addLast(ticket);
      boolean accepted = delegate.offer(ticket);
      if (!accepted) pending.removeLastOccurrence(ticket);
      return accepted;
    }
  }

  @Override public MountItem poll() { return delegate.poll(); }
  @Override public MountItem peek() { return delegate.peek(); }
  @Override public int size() { return delegate.size(); }
  @Override public Iterator<MountItem> iterator() { return delegate.iterator(); }

  public static class Ledger {
    private final Map<Integer, ArrayDeque<Ticket>> surfaces = new HashMap<>();
    private final Set<Integer> mounting = new HashSet<>();

    public synchronized void register(int surfaceId) {
      if (surfaces.containsKey(surfaceId)) {
        throw new IllegalStateException("Holder surface is already registered: " + surfaceId);
      }
      ArrayDeque<Ticket> pending = new ArrayDeque<>();
      surfaces.put(surfaceId, pending);
    }

    public synchronized void unregister(int surfaceId) {
      // Tickets may already live in RN's local batch. Retire them there as well as
      // in the shared queues, and release their references to native mutation data.
      ArrayDeque<Ticket> pending = surfaces.remove(surfaceId);
      if (pending != null) {
        for (Ticket ticket : pending) ticket.item = null;
      }
    }

    public void flush(int surfaceId, MountingManager manager) {
      while (true) {
        Ticket next;
        synchronized (this) {
          ArrayDeque<Ticket> pending = surfaces.get(surfaceId);
          if (pending == null) {
            throw new IllegalStateException("Unknown holder surface: " + surfaceId);
          }
          next = pending.peekFirst();
          if (next == null) return;
        }
        executeThrough(next, manager);
      }
    }

    private void executeThrough(Ticket target, MountingManager manager) {
      while (true) {
        Ticket next;
        MountItem item;
        synchronized (this) {
          if (target.item == null) return;
          int surfaceId = target.surfaceId;
          if (mounting.contains(surfaceId)) {
            throw new IllegalStateException("Cannot reenter mounting of holder surface: " + surfaceId);
          }
          ArrayDeque<Ticket> pending = surfaces.get(surfaceId);
          if (pending == null) return;
          next = pending.removeFirst();
          item = next.item;
          // A failed mutation may be partially applied; it must not be replayed.
          next.item = null;
          mounting.add(surfaceId);
        }
        try {
          item.execute(manager);
        } finally {
          synchronized (this) {
            mounting.remove(next.surfaceId);
          }
        }
        if (next == target) return;
      }
    }
  }

  private static final class Ticket implements MountItem {
    private MountItem item;
    private final int surfaceId;
    private final Ledger ledger;

    Ticket(MountItem item, int surfaceId, Ledger ledger) {
      this.item = item;
      this.surfaceId = surfaceId;
      this.ledger = ledger;
    }

    @Override public int getSurfaceId() { return surfaceId; }
    @Override public void execute(MountingManager manager) { ledger.executeThrough(this, manager); }
    @Override public String toString() { return "Holder mount ticket for surface " + surfaceId; }
  }
}
