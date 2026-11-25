import { useEffect, useRef, useSyncExternalStore } from 'react';
import { supabase } from '@sombill/api-client/supabase';

export type RealtimeTable =
  | 'products'
  | 'categories'
  | 'restaurant_tables'
  | 'orders'
  | 'order_items'
  | 'payments'
  | 'inventory_items'
  | 'notifications'
  | 'refunds'
  | 'cashier_shifts'
  | 'receipts';

export type RealtimeHealth = 'live' | 'connecting' | 'offline';

// --- tiny connection-health store shared by all subscriptions -------------
const channelState = new Map<string, RealtimeHealth>();
const listeners = new Set<() => void>();
let snapshot: RealtimeHealth = 'live';
function recompute() {
  const states = [...channelState.values()];
  snapshot = !states.length
    ? 'live'
    : states.includes('offline')
      ? 'offline'
      : states.includes('connecting')
        ? 'connecting'
        : 'live';
  listeners.forEach((l) => l());
}
function setChannelState(id: string, s: RealtimeHealth | null) {
  if (s === null) channelState.delete(id);
  else channelState.set(id, s);
  recompute();
}
export function useRealtimeHealth(): RealtimeHealth {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => 'live',
  );
}

interface Options {
  debounceMs?: number;
  filter?: string;
}

/**
 * Subscribes to Postgres changes for the given tables (filtered to one restaurant by
 * default, or a custom `filter`) and calls `onChange` (debounced).
 * - Reconnects with exponential backoff after CHANNEL_ERROR / TIMED_OUT / CLOSED.
 * - Calls `onChange` after a reconnect and when the browser comes back online or the
 *   tab becomes visible, so no updates are missed while disconnected.
 * - Removes the channel on unmount.
 */
export function useRealtime(
  tables: RealtimeTable[],
  restaurantId: string | undefined,
  onChange: () => void,
  opts: Options = {},
): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(',');
  const debounceMs = opts.debounceMs ?? 400;
  const filter = opts.filter;

  useEffect(() => {
    if (!restaurantId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let hadError = false;
    const id = `${key}:${Math.random().toString(36).slice(2, 8)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), debounceMs);
    };

    const connect = () => {
      if (disposed) return;
      setChannelState(id, 'connecting');
      const ch = supabase.channel(`rt:${restaurantId}:${id}:${attempt}`);
      // Once we tear a channel down, ignore its remaining status events: removeChannel()
      // emits CLOSED synchronously, which must not trigger another teardown/retry.
      let closedByUs = false;
      for (const table of key.split(',')) {
        ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: filter ?? `restaurant_id=eq.${restaurantId}` },
          fire,
        );
      }
      ch.subscribe((status: string) => {
        if (disposed || closedByUs) return;
        if (status === 'SUBSCRIBED') {
          setChannelState(id, 'live');
          if (hadError) {
            hadError = false;
            fire();
          } // resync anything missed
          attempt = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelState(id, 'offline');
          hadError = true;
          closedByUs = true;
          void supabase.removeChannel(ch);
          clearTimeout(retryTimer);
          retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt++));
        }
      });
      channel = ch;
    };
    connect();

    const onOnline = () => fire();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fire();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      setChannelState(id, null);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, restaurantId, debounceMs, filter]);
}
