import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileCheck2 } from 'lucide-react';
import { Badge, Card, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { friendlyError } from '@sombill/api-client/supabase';
import { formatDate, formatMoney, formatNumber } from '@sombill/shared-utils/format';
import { recordTaxFiling, taxDue, taxFilings } from '../services/hq';
import { useHq } from '../features/HqContext';
import { formatConverted, sumConverted } from '../features/lib/money';
import type { TaxDueRow } from '../features/types';

/** Last 12 months as selectable periods (calendar months). */
function months() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const from = new Date(now.getFullYear(), now.getMonth() - i - 1 + 1, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return {
      value: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
      label: from.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      from,
      to,
    };
  });
}

export default function TaxPage() {
  const { org, branches, scopeIds, fx } = useHq();
  const toast = useToast();
  const opts = useMemo(months, []);
  // Default to the last complete month
  const [period, setPeriod] = useState(opts[1]?.value ?? opts[0]!.value);
  const p = opts.find((o) => o.value === period) ?? opts[0]!;
  const due = useQuery(() => taxDue(org.id, p.from, p.to), [org.id, period]);
  const filings = useQuery(() => taxFilings(org.id), [org.id]);
  const [target, setTarget] = useState<TaxDueRow | null>(null);
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = (due.data ?? []).filter((r) => scopeIds.includes(r.restaurant_id));
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';
  const total = useMemo(
    () =>
      sumConverted(
        rows,
        (r) => r.tax_collected,
        (r) => r.currency,
        fx,
      ),
    [rows, fx],
  );
  const periodEnded = p.to < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const file = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await recordTaxFiling(org.id, target.restaurant_id, p.from, p.to, ref.trim(), notes.trim());
      toast.success(`${name(target.restaurant_id)} recorded as filed for ${p.label}.`);
      setTarget(null);
      setRef('');
      setNotes('');
      await Promise.all([due.reload(), filings.reload()]);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Consolidated Finance · Compliance"
        title="Tax Filings"
        description="Tax collected per branch from its orders, and a register of which periods you have filed. SomBill records your filings; it does not submit them to the tax authority."
        actions={
          <>
            <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              disabled={!rows.length}
              onClick={() =>
                downloadCsv(
                  `tax-${period}`,
                  ['Branch', 'Currency', 'Rate', 'Taxable sales', 'Tax collected', 'Orders', 'Filed', 'Reference'],
                  rows.map((r) => [
                    name(r.restaurant_id),
                    r.currency,
                    r.tax_rate,
                    r.taxable_sales,
                    r.tax_collected,
                    r.orders_count,
                    r.filed_at ? 'yes' : 'no',
                    r.filing_reference,
                  ]),
                )
              }
            >
              Export CSV
            </Button>
          </>
        }
      />
      <Card
        title={`Tax due · ${p.label}`}
        bodyClassName="p-0"
        className="mb-4"
        action={<span className="text-sm font-semibold">Group total: {formatConverted(total, fx)}</span>}
      >
        {due.error ? (
          <ErrorState message={due.error} onRetry={due.reload} />
        ) : due.loading ? (
          <TableSkeleton cols={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col">Rate</th>
                  <th scope="col" className="text-right">
                    Taxable sales
                  </th>
                  <th scope="col" className="text-right">
                    Tax collected
                  </th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.restaurant_id}>
                    <td className="font-semibold">{name(r.restaurant_id)}</td>
                    <td>
                      {(r.tax_rate * 100).toFixed(2).replace(/\.?0+$/, '')}% {r.tax_label}
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(r.taxable_sales, r.currency)}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {formatMoney(r.tax_collected, r.currency)}
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(r.orders_count)}</td>
                    <td>
                      {r.filed_at ? (
                        <Badge tone="green">
                          Filed {formatDate(r.filed_at)}
                          {r.filing_reference ? ` · ${r.filing_reference}` : ''}
                        </Badge>
                      ) : (
                        <Badge tone="yellow">Not filed</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      {r.filed_at ? (
                        <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-600" aria-label="Filed" />
                      ) : (
                        <Button
                          size="sm"
                          disabled={!periodEnded}
                          title={periodEnded ? undefined : 'The period has not ended yet'}
                          icon={<FileCheck2 className="h-3.5 w-3.5" />}
                          onClick={() => {
                            setError(null);
                            setTarget(r);
                          }}
                        >
                          Record as filed
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Filing register" bodyClassName="p-0">
        {filings.error ? (
          <ErrorState message={filings.error} onRetry={filings.reload} />
        ) : (filings.data ?? []).filter((f) => scopeIds.includes(f.restaurant_id)).length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Branch</th>
                  <th scope="col" className="text-right">
                    Tax
                  </th>
                  <th scope="col">Reference</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {(filings.data ?? [])
                  .filter((f) => scopeIds.includes(f.restaurant_id))
                  .map((f) => (
                    <tr key={f.id}>
                      <td>
                        {f.period_from} → {f.period_to}
                      </td>
                      <td>{name(f.restaurant_id)}</td>
                      <td className="text-right tabular-nums">{formatMoney(f.tax_collected, f.currency)}</td>
                      <td>{f.reference ?? '—'}</td>
                      <td>{formatDate(f.filed_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Record filing"
        description={
          target
            ? `${name(target.restaurant_id)} · ${p.label} · ${formatMoney(target.tax_collected, target.currency)}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={file}>
              Record as filed
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            The amount is recalculated from the orders when you confirm, and a period can be recorded only once per
            branch.
          </p>
          <Input label="Receipt / reference number" value={ref} onChange={(e) => setRef(e.target.value)} />
          <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
