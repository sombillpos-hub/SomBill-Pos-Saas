import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { AuditTable } from '../components/AuditTable';
import { useHq } from '../features/HqContext';
import { useAudit } from '../hooks/hq';
import type { Risk } from '../features/types';

export default function AuditPage() {
  const { branches } = useHq();
  const [days, setDays] = useState(7);
  const [risk, setRisk] = useState<'all' | Risk>('all');
  const [state, setState] = useState<'open' | 'all' | 'cleared'>('open');
  const audit = useAudit(days);
  const items = useMemo(
    () =>
      audit.items
        .filter((i) => risk === 'all' || i.risk === risk)
        .filter((i) =>
          state === 'all'
            ? true
            : state === 'cleared'
              ? i.review?.status === 'cleared'
              : i.review?.status !== 'cleared',
        ),
    [audit.items, risk, state],
  );
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? '';

  return (
    <div>
      <PageHeader
        eyebrow="Security & Infra · Governance"
        title="Audit & Anti-Fraud"
        description="Cancellations, refunds, large discounts, deletions and cash-drawer differences from every branch, with your review of each."
        actions={
          <>
            <select
              className="input h-10"
              aria-label="Period"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <select
              className="input h-10"
              aria-label="Risk"
              value={risk}
              onChange={(e) => setRisk(e.target.value as 'all' | Risk)}
            >
              <option value="all">All risks</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              className="input h-10"
              aria-label="Review state"
              value={state}
              onChange={(e) => setState(e.target.value as 'open' | 'all' | 'cleared')}
            >
              <option value="open">Not cleared</option>
              <option value="cleared">Cleared</option>
              <option value="all">Everything</option>
            </select>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              disabled={!items.length}
              onClick={() =>
                downloadCsv(
                  `audit-${days}d`,
                  ['Time', 'Branch', 'Employee', 'Event', 'Detail', 'Risk', 'Review', 'Note'],
                  items.map((i) => [
                    i.at,
                    name(i.restaurantId),
                    i.actorName,
                    i.title,
                    i.detail,
                    i.risk,
                    i.review?.status ?? 'open',
                    i.review?.note,
                  ]),
                )
              }
            >
              Export CSV
            </Button>
          </>
        }
      />
      <Card bodyClassName="p-0" className="mb-4">
        <AuditTable
          items={items}
          loading={audit.loading}
          error={audit.error}
          onRetry={audit.reload}
          onReview={audit.review}
        />
      </Card>
      <Card title="How events are flagged">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            <b>High:</b> a record was deleted; a cash drawer closed with a difference of 5% or more of expected cash; a
            refund of 100 or more; a discount of 30% or more.
          </li>
          <li>
            <b>Medium:</b> an order was cancelled; a refund; a drawer difference under 5%; a discount of 15% to 30%.
          </li>
          <li>
            <b>Low:</b> a rejected mobile payment, a reprinted receipt, a menu price change.
          </li>
          <li>
            Approving or investigating an event saves your decision and note. It never changes the original record.
          </li>
        </ul>
      </Card>
    </div>
  );
}
