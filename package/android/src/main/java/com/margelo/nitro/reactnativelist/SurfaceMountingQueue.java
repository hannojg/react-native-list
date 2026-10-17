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
 * Tracks owned work before Fabric drains its queue into an inaccessible local batch.
 * Early execution leaves an exactly-once ticket in RN's batch, preserving its normal
 * completion notifications without replaying mutations when the outer mount resumes.
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
