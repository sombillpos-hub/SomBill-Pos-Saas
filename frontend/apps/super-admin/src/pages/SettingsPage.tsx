import { useState } from 'react';
import { Layers, Save } from 'lucide-react';
import { Card, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { Input } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { friendlyError } from '@sombill/api-client/supabase';
import { applyDefaults, updateSettings } from '../services/hq';
import { useHq } from '../features/HqContext';

const PERMS: [string, string][] = [
  ['cashier_can_cancel_orders', 'Cashiers can cancel orders'],
  ['cashier_can_refund', 'Cashiers can refund'],
  ['cashier_can_create_customers', 'Cashiers can create customers'],
  ['waiter_can_create_customers', 'Waiters can create customers'],
];

export default function SettingsPage() {
  const { org, fx, branches } = useHq();
  const { reloadOrganization } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(org.name);
  const [reporting, setReporting] = useState(fx.reporting);
  const [rates, setRates] = useState<{ cur: string; rate: string }[]>(
    Object.entries(fx.rates).map(([cur, rate]) => ({ cur, rate: String(rate) })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targets, setTargets] = useState<string[]>(branches.map((b) => b.id));
  const [apply, setApply] = useState({
    tax: false,
    taxPct: '',
    label: '',
    inclusive: false,
    setInclusive: false,
    footer: false,
    footerText: '',
  });
  const [perms, setPerms] = useState<Record<string, boolean | undefined>>({});
  const [confirm, setConfirm] = useState(false);

  const saveGroup = async () => {
    setError(null);
    const map: Record<string, number> = {};
    for (const r of rates) {
      if (!r.cur.trim() && !r.rate.trim()) continue;
      const v = Number(r.rate);
      if (!/^[A-Za-z]{3}$/.test(r.cur.trim()) || !(v > 0))
        return setError('Each exchange rate needs a 3-letter currency and a number above 0.');
      map[r.cur.trim().toUpperCase()] = v;
    }
    setBusy(true);
    try {
      await updateSettings(org.id, name.trim(), reporting.trim().toUpperCase(), map);
      await reloadOrganization();
      toast.success('Group settings saved.');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const fields = () => {
    const f: Record<string, unknown> = {};
    if (apply.tax) f.tax_rate = Number(apply.taxPct) / 100;
    if (apply.tax && apply.label.trim()) f.tax_label = apply.label.trim();
    if (apply.setInclusive) f.tax_inclusive = apply.inclusive;
    if (apply.footer) f.receipt_footer = apply.footerText;
    const p = Object.fromEntries(Object.entries(perms).filter(([, v]) => v !== undefined));
    if (Object.keys(p).length) f.permissions = p;
    return f;
  };
  const chosen = fields();
  const taxOk = !apply.tax || (apply.taxPct.trim() !== '' && Number(apply.taxPct) >= 0 && Number(apply.taxPct) < 100);
  const canApply = Object.keys(chosen).length > 0 && targets.length > 0 && taxOk;

  const run = async () => {
    try {
      const n = await applyDefaults(org.id, targets, chosen);
      toast.success(`Applied to ${n} branch${n === 1 ? '' : 'es'}.`);
      setConfirm(false);
    } catch (e) {
      throw new Error(friendlyError(e));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Security & Infra · Governance"
        title="Platform Controls"
        description="Group-wide settings. Each branch keeps its own Settings page for everything else."
      />
      <Card
        title="Group & exchange rates"
        action={
          <Button icon={<Save className="h-4 w-4" />} loading={busy} onClick={saveGroup}>
            Save
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Reporting currency"
            maxLength={3}
            value={reporting}
            onChange={(e) => setReporting(e.target.value.toUpperCase())}
            hint="Group totals are shown in this currency"
          />
        </div>
        <fieldset className="mt-4">
          <legend className="label">Exchange rates (units of the currency per 1 USD)</legend>
          <div className="space-y-2">
            {rates.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input h-10 w-24"
                  aria-label={`Currency ${i + 1}`}
                  maxLength={3}
                  placeholder="SLS"
                  value={r.cur}
                  onChange={(e) =>
                    setRates(rates.map((x, j) => (j === i ? { ...x, cur: e.target.value.toUpperCase() } : x)))
                  }
                />
                <input
                  className="input h-10 w-40"
                  aria-label={`Rate ${i + 1}`}
                  type="number"
                  min={0}
                  step="any"
                  placeholder="11800"
                  value={r.rate}
                  onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRates(rates.filter((_, j) => j !== i))}
                  aria-label={`Remove rate ${i + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setRates([...rates, { cur: '', rate: '' }])}>
              Add rate
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Without a rate, amounts in that currency are listed separately instead of being added to group totals.
          </p>
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </Card>

      <Card
        title="Apply defaults to branches"
        action={
          <Button
            variant="secondary"
            icon={<Layers className="h-4 w-4" />}
            disabled={!canApply}
            onClick={() => setConfirm(true)}
          >
            Apply…
          </Button>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Tick what to change. Anything unticked stays as each branch has it.
        </p>
        <fieldset className="mb-4">
          <legend className="label">Branches</legend>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <label
                key={b.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={targets.includes(b.id)}
                  onChange={(e) => setTargets((c) => (e.target.checked ? [...c, b.id] : c.filter((x) => x !== b.id)))}
                />
                {b.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={apply.tax}
              onChange={(e) => setApply({ ...apply, tax: e.target.checked })}
            />{' '}
            Tax rate
          </label>
          {apply.tax && (
            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <Input
                label="Rate (%)"
                type="number"
                min={0}
                step="0.01"
                value={apply.taxPct}
                onChange={(e) => setApply({ ...apply, taxPct: e.target.value })}
              />
              <Input
                label="Label"
                placeholder="VAT"
                value={apply.label}
                onChange={(e) => setApply({ ...apply, label: e.target.value })}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={apply.setInclusive}
              onChange={(e) => setApply({ ...apply, setInclusive: e.target.checked })}
            />{' '}
            Prices include tax
          </label>
          {apply.setInclusive && (
            <label className="ml-6 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={apply.inclusive}
                onChange={(e) => setApply({ ...apply, inclusive: e.target.checked })}
              />{' '}
              Yes, menu prices already include tax
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={apply.footer}
              onChange={(e) => setApply({ ...apply, footer: e.target.checked })}
            />{' '}
            Receipt footer
          </label>
          {apply.footer && (
            <Input
              label="Footer text"
              value={apply.footerText}
              onChange={(e) => setApply({ ...apply, footerText: e.target.value })}
              wrapClassName="max-w-md"
            />
          )}
          <fieldset>
            <legend className="label">Staff permissions</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERMS.map(([k, label]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <select
                    className="input h-8 w-32"
                    aria-label={label}
                    value={perms[k] === undefined ? 'keep' : perms[k] ? 'on' : 'off'}
                    onChange={(e) =>
                      setPerms({ ...perms, [k]: e.target.value === 'keep' ? undefined : e.target.value === 'on' })
                    }
                  >
                    <option value="keep">Keep</option>
                    <option value="on">Allow</option>
                    <option value="off">Deny</option>
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>
      <ConfirmDialog
        open={confirm}
        title="Apply to branches?"
        message={`This changes ${Object.keys(chosen).join(', ').replace(/_/g, ' ')} in ${targets.length} branch${targets.length === 1 ? '' : 'es'}. Changes are recorded in each branch's audit log.`}
        confirmLabel="Apply"
        onConfirm={run}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
