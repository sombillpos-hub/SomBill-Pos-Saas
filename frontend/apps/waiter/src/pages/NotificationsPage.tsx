import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { formatDateTime } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { AppNotification } from '@sombill/shared-types/types';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { fetchNotifications } from '@sombill/api-client/orderData';

const TYPE_DOT: Record<string, string> = {
  order_ready: 'bg-emerald-500',
  payment_completed: 'bg-emerald-500',
  order_cancelled: 'bg-brand-red',
  bill_acknowledged: 'bg-sky-500',
  order_accepted: 'bg-indigo-500',
  order_preparing: 'bg-brand-orange',
  table_status: 'bg-slate-400',
};

export default function NotificationsPage() {
  const r = useRestaurant();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const q = useQuery(() => fetchNotifications(uid), [uid]);
  useRealtime(['notifications'], r.id, () => void q.reload(), { filter: `user_id=eq.${uid}`, debounceMs: 200 });
  const list = useMemo(() => (q.data ?? []).filter((n) => tab === 'all' || !n.read_at), [q.data, tab]);
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  const readCount = (q.data ?? []).filter((n) => n.read_at).length;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      unwrap(
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).select('id'),
      );
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };
  const open = async (n: AppNotification) => {
    if (!n.read_at) await markRead([n.id]);
    if (n.order_id)
      navigate(
        n.type === 'payment_completed' || n.type === 'bill_acknowledged'
          ? `/waiter/bills?order=${n.order_id}`
          : `/waiter/orders/${n.order_id}`,
      );
  };
  const clearRead = async () => {
    unwrap(await supabase.from('notifications').delete().eq('user_id', uid).not('read_at', 'is', null).select('id'));
    toast.success('Read notifications cleared.');
    setConfirmClear(false);
    await q.reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Account · Live Alerts"
        title="Notifications"
        description="Kitchen, cashier and table updates for your orders."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<CheckCheck className="h-4 w-4" />}
              disabled={!unread}
              onClick={() => void markRead((q.data ?? []).filter((n) => !n.read_at).map((n) => n.id))}
            >
              Mark all read
            </Button>
            <Button
              variant="secondary"
              icon={<Trash2 className="h-4 w-4" />}
              disabled={!readCount}
              onClick={() => setConfirmClear(true)}
            >
              Clear read
            </Button>
          </>
        }
      />
      <Card bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All', count: q.data?.length ?? 0 },
              { id: 'unread', label: 'Unread', count: unread },
            ]}
          />
        </div>
        {q.error ? (
          <ErrorState message={q.error} onRetry={q.reload} />
        ) : q.loading && !q.data ? (
          <div className="p-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !list.length ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title={tab === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
          />
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Notifications">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void open(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50',
                    !n.read_at && 'bg-orange-50/50',
                  )}
                  aria-label={`${n.read_at ? '' : 'Unread: '}${n.title}`}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                      n.read_at ? 'bg-slate-200' : (TYPE_DOT[n.type] ?? 'bg-brand-orange'),
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', !n.read_at && 'font-semibold')}>{n.title}</span>
                    {n.body && <span className="block text-sm text-slate-500">{n.body}</span>}
                    <span className="text-xs text-slate-400">{formatDateTime(n.created_at, r.timezone)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={confirmClear}
        title="Clear read notifications?"
        message="Read notifications will be removed. Unread ones are kept."
        confirmLabel="Clear"
        onConfirm={clearRead}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
