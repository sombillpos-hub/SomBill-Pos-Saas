import { useEffect, useState } from 'react';
import { useRealtimeHealth } from '@sombill/shared-hooks/useRealtime';
import { useNetworkProfile } from '@sombill/shared-hooks/useNetworkProfile';
import { offlineQueue, type OfflineSyncSnapshot } from '@sombill/api-client/offlineQueue';

const LABEL = { live: 'Live sync', connecting: 'Connecting…', syncing: 'Syncing…', offline: 'Offline' } as const;

/**
 * Real connection & sync indicator: combines browser online status, realtime channel health,
 * 2G/3G adaptive Lite Mode activation, and the offline transaction queue state.
 */
export function ConnectionBadge() {
  const health = useRealtimeHealth();
  const net = useNetworkProfile();
  const [queue, setQueue] = useState<OfflineSyncSnapshot>(() => offlineQueue.getSnapshot());

  useEffect(() => offlineQueue.subscribe(setQueue), []);

  const state: keyof typeof LABEL = !net.online ? 'offline' : queue.syncing ? 'syncing' : health;

  const text =
    state === 'syncing' && queue.pendingCount > 0
      ? `Syncing (${queue.pendingCount})`
      : state === 'offline' && queue.pendingCount > 0
        ? `Offline · ${queue.pendingCount} queued`
        : LABEL[state];

  return (
    <span
      className="sb-conn"
      data-state={state}
      role="status"
      aria-label={`Connection: ${text}`}
      title={
        net.liteMode
          ? `Low-bandwidth Lite Mode active (${net.effectiveType})`
          : queue.failedCount > 0
            ? `${queue.failedCount} sync issue(s) need attention`
            : undefined
      }
    >
      <i aria-hidden />
      {text}
    </span>
  );
}
