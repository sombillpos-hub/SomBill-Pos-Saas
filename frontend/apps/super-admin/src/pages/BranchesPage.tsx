import { useState } from 'react';
import { Building2, Pencil, Plus, Zap } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Input } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { friendlyError } from '@sombill/api-client/supabase';
import { formatDuration, formatMoney, formatNumber } from '@sombill/shared-utils/format';
import { createBranch, updateBranch } from '../services/hq';
import { useHq } from '../features/HqContext';
import { useSummary } from '../hooks/hq';
import { useEnterBranch } from '../components/useEnterBranch';
import { branchColor } from '../features/lib/colors';
import type { Branch } from '../features/types';

const EMPTY = { name: '', address: '', phone: '', currency: 'USD', timezone: 'Africa/Mogadishu', taxPct: '0' };

export default function BranchesPage() {
  const { org, branches, branchesLoading, branchesError, reloadBranches, refreshLive } = useHq();
  const summary = useSummary('today');
  const enter = useEnterBranch();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [edit, setEdit] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState({ name: '', address: '', phone: '', email: '', timezone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atLimit = branches.length >= org.max_branches;
  const sumOf = (id: string) => summary.data?.cur.find((s) => s.restaurant_id === id);

  const after = async () => {
    await Promise.all([reloadBranches(), summary.reload(), refreshLive()]);
  };
  const add = async () => {
    setError(null);
    const pct = Number(form.taxPct);
    if (form.name.trim().length < 2) return setError('Branch name is too short.');
    if (!/^[A-Za-z]{3}$/.test(form.currency)) return setError('Currency must be a 3-letter code, e.g. USD.');
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return setError('Tax must be between 0 and 99.99 %.');
    setBusy(true);
    try {
      await createBranch(org.id, {
        name: form.name.trim(),
        currency: form.currency.toUpperCase(),
        timezone: form.timezone.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        taxRate: pct / 100,
      });
      toast.success(`${form.name.trim()} added to the group.`);
      setAdding(false);
      setForm(EMPTY);
      await after();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!edit) return;
    setError(null);
    if (editForm.name.trim().length < 2) return setError('Branch name is too short.');
    setBusy(true);
    try {
      await updateBranch(edit.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim() || null,
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        timezone: editForm.timezone.trim(),
      });
      toast.success('Branch updated.');
      setEdit(null);
      await after();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Global Command · Fleet"
        title="Multi-Branch Fleet"
        description={`${branches.length} of ${org.max_branches} branches on the ${org.plan} plan.`}
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            disabled={atLimit}
            title={atLimit ? 'Your plan’s branch limit is reached' : undefined}
            onClick={() => {
              setError(null);
              setAdding(true);
            }}
          >
            Add branch
          </Button>
        }
      />
      {atLimit && (
        <p className="mb-4 text-sm text-amber-700">
          Branch limit reached for your plan. Contact your SomBill account manager to add more.
        </p>
      )}
      <Card bodyClassName="p-0">
        {branchesError ? (
          <ErrorState message={branchesError} onRetry={reloadBranches} />
        ) : branchesLoading ? (
          <TableSkeleton cols={6} />
        ) : branches.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No branches yet"
            message="Add the first branch to start collecting group numbers."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col">Currency · tax</th>
                  <th scope="col" className="text-right">
                    Today
                  </th>
                  <th scope="col" className="text-right">
                    Orders
                  </th>
                  <th scope="col">Tables</th>
                  <th scope="col">Registers · staff</th>
                  <th scope="col">Last order</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b, i) => {
                  const s = sumOf(b.id);
                  return (
                    <tr key={b.id}>
                      <td>
                        <p className="flex items-center gap-2 font-semibold">
                          <i className="sa-dot" style={{ background: branchColor(i) }} aria-hidden />
                          {b.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {b.address || b.timezone}
                          {b.phone ? ` · ${b.phone}` : ''}
                        </p>
                      </td>
                      <td>
                        {b.currency} ·{' '}
                        <Badge>
                          {(b.tax_rate * 100).toFixed(2).replace(/\.?0+$/, '')}% {b.tax_label}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums">{s ? formatMoney(s.gross, b.currency) : '—'}</td>
                      <td className="text-right tabular-nums">{s ? formatNumber(s.orders_count) : '—'}</td>
                      <td>{s ? `${s.tables_occupied}/${s.tables_total}` : '—'}</td>
                      <td>{s ? `${s.open_cashier_shifts} open · ${s.staff_on_duty} on duty` : '—'}</td>
                      <td>{s?.last_order_at ? `${formatDuration(s.last_order_at)} ago` : '—'}</td>
                      <td className="whitespace-nowrap text-right">
                        <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />} onClick={() => enter(b.id)}>
                          Open
                        </Button>{' '}
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          aria-label={`Edit ${b.name}`}
                          onClick={() => {
                            setError(null);
                            setEdit(b);
                            setEditForm({
                              name: b.name,
                              address: b.address ?? '',
                              phone: b.phone ?? '',
                              email: b.email ?? '',
                              timezone: b.timezone,
                            });
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add branch"
        description="The branch starts empty. Open it to set up its menu, tables and staff."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={add}>
              Add branch
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Branch name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            wrapClassName="sm:col-span-2"
          />
          <Input
            label="Address / city"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            label="Currency"
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            hint="3-letter code, e.g. USD"
          />
          <Input
            label="Tax rate (%)"
            type="number"
            min={0}
            step="0.01"
            value={form.taxPct}
            onChange={(e) => setForm({ ...form, taxPct: e.target.value })}
          />
          <Input
            label="Time zone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            wrapClassName="sm:col-span-2"
            hint="e.g. Africa/Mogadishu"
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </Modal>

      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={`Edit ${edit?.name ?? 'branch'}`}
        description="Currency and tax are changed in the branch's own Settings or in Platform Controls."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Branch name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            wrapClassName="sm:col-span-2"
          />
          <Input
            label="Address / city"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
          <Input
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Time zone"
            value={editForm.timezone}
            onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}
