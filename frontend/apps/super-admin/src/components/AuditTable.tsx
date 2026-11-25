import { useState } from 'react';
import { Check, Search, ShieldAlert } from 'lucide-react';
import { Badge, EmptyState, ErrorState, TableSkeleton, type Tone } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Textarea } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { friendlyError } from '@sombill/api-client/supabase';
import { formatDateTime, formatMoney } from '@sombill/shared-utils/format';
import { useHq } from '../features/HqContext';
import type { AuditItem } from '../hooks/hq';
import type { ReviewStatus, Risk } from '../features/types';

export const RISK_TONE: Record<Risk, Tone> = { high: 'red', medium: 'orange', low: 'gray' };
const STATUS_LABEL: Record<ReviewStatus, string> = {
  investigating: 'Investigating',
  cleared: 'Cleared',
  escalated: 'Escalated',
};
const STATUS_TONE: Record<ReviewStatus, Tone> = { investigating: 'yellow', cleared: 'green', escalated: 'red' };

interface Props {
  items: AuditItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onReview: (key: string, status: ReviewStatus, note: string) => Promise<void>;
  limit?: number;
}

/** Flagged events with Approve (clear) / Investigate actions. The owner's decision and note are stored per event. */
export function AuditTable({ items, loading, error, onRetry, onReview, limit }: Props) {
  const { branches } = useHq();
  const toast = useToast();
  const [target, setTarget] = useState<{ item: AuditItem; status: ReviewStatus } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = limit ? items.slice(0, limit) : items;
  const branch = (id: string) => branches.find((b) => b.id === id);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await onReview(target.item.key, target.status, note.trim());
      toast.success(`Marked as ${STATUS_LABEL[target.status].toLowerCase()}.`);
      setTarget(null);
      setNote('');
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) return <TableSkeleton cols={6} />;
  if (!rows.length)
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Nothing flagged"
        message="No suspicious activity in this period for the selected branches."
      />
    );

  return (
    <>
      <div className="overflow-x-auto">
        <table className="sa-table min-w-full">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Branch</th>
              <th scope="col">Employee</th>
              <th scope="col">Event</th>
              <th scope="col">Risk</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => {
              const b = branch(it.restaurantId);
              return (
                <tr key={it.key} data-risk={it.risk}>
                  <td className="whitespace-nowrap">{formatDateTime(it.at, b?.timezone ?? 'Africa/Mogadishu')}</td>
                  <td>{b?.name ?? '—'}</td>
                  <td>{it.actorName}</td>
                  <td>
                    <p className="font-semibold">{it.title}</p>
                    <p className="text-xs text-slate-500">
                      {it.detail}
                      {it.amount !== null && b ? ` · ${formatMoney(it.amount, b.currency)}` : ''}
                    </p>
                    {it.review?.note && <p className="text-xs italic text-slate-500">Owner note: {it.review.note}</p>}
                  </td>
                  <td>
                    <Badge tone={RISK_TONE[it.risk]}>
                      {it.risk === 'high' ? 'High' : it.risk === 'medium' ? 'Medium' : 'Low'}
                    </Badge>
                  </td>
                  <td>
                    {it.review ? (
                      <Badge tone={STATUS_TONE[it.review.status]}>{STATUS_LABEL[it.review.status]}</Badge>
                    ) : (
                      <Badge>Open</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() => setTarget({ item: it, status: 'cleared' })}
                      disabled={it.review?.status === 'cleared'}
                    >
                      Approve
                    </Button>{' '}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Search className="h-3.5 w-3.5" />}
                      onClick={() => setTarget({ item: it, status: 'investigating' })}
                    >
                      Investigate
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.status === 'cleared' ? 'Approve this event' : 'Investigate this event'}
        description={target ? `${target.item.title} · ${target.item.actorName}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            {target?.status === 'investigating' && (
              <Button
                variant="danger"
                loading={busy}
                onClick={() => target && setTarget({ ...target, status: 'escalated' })}
              >
                Escalate instead
              </Button>
            )}
            <Button loading={busy} onClick={submit}>
              {target?.status === 'cleared'
                ? 'Mark cleared'
                : target?.status === 'escalated'
                  ? 'Mark escalated'
                  : 'Mark investigating'}
            </Button>
          </>
        }
      >
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you find, or who will follow up?"
        />
      </Modal>
    </>
  );
}
