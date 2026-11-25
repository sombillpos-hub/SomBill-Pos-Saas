import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@sombill/shared-ui/ui/Button';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { Input, Select } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { friendlyError } from '@sombill/api-client/supabase';
import { formatMoney } from '@sombill/shared-utils/format';
import { pushMenuItem } from '../services/hq';
import { useHq } from '../features/HqContext';
import type { MenuMatrixRow, PushResult } from '../features/types';

interface Props {
  matrix: MenuMatrixRow[];
  /** Pre-fills the form (e.g. when a row of the master list is picked). */
  initialName?: string;
  onDone: () => void;
  compact?: boolean;
}

/** Sets a dish's price/availability in the chosen branches in one step, matching dishes by name (case-insensitive). */
export function MenuPushForm({ matrix, initialName = '', onDone, compact }: Props) {
  const { org, branches } = useHq();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState('');
  const [avail, setAvail] = useState<'keep' | 'on' | 'off'>('keep');
  const [targets, setTargets] = useState<string[]>(branches.map((b) => b.id));
  const [create, setCreate] = useState(false);
  const [category, setCategory] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ rows: PushResult[]; ms: number } | null>(null);

  useEffect(() => setName(initialName), [initialName]);
  useEffect(() => setTargets((t) => (t.length ? t : branches.map((b) => b.id))), [branches]);

  const names = useMemo(
    () => [...new Set(matrix.map((m) => m.name.trim()))].sort((a, b) => a.localeCompare(b)),
    [matrix],
  );
  const priceNum = price.trim() === '' ? null : Number(price);
  const valid =
    name.trim().length > 0 &&
    targets.length > 0 &&
    (priceNum !== null || avail !== 'keep') &&
    (priceNum === null || (Number.isFinite(priceNum) && priceNum >= 0));

  const run = async () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      const rows = await pushMenuItem(org.id, {
        name: name.trim(),
        targets,
        price: priceNum,
        available: avail === 'keep' ? null : avail === 'on',
        createMissing: create,
        category: category.trim() || null,
      });
      const ms = Math.round(performance.now() - t0);
      setResults({ rows, ms });
      const done = rows.filter((r) => r.status !== 'missing').length;
      toast.success(`Menu synchronized with ${done} branch${done === 1 ? '' : 'es'} in ${ms} ms`);
      onDone();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setConfirm(true);
      }}
    >
      <div className={compact ? 'grid gap-3 sm:grid-cols-[2fr_1fr_1fr]' : 'grid gap-3 sm:grid-cols-2'}>
        <div>
          <Input
            label="Dish name"
            list="sa-dishes"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Goat Meat"
            required
          />
          <datalist id="sa-dishes">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <Input
          label="New price"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="Leave empty to keep prices"
        />
        <Select label="Availability" value={avail} onChange={(e) => setAvail(e.target.value as 'keep' | 'on' | 'off')}>
          <option value="keep">Keep as is</option>
          <option value="on">Available</option>
          <option value="off">Sold out / hidden</option>
        </Select>
      </div>
      <fieldset>
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
                onChange={(e) =>
                  setTargets((cur) => (e.target.checked ? [...cur, b.id] : cur.filter((x) => x !== b.id)))
                }
              />
              {b.name}
              <span className="text-xs text-slate-500">({b.currency})</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} />
          Add the dish where it does not exist yet
        </label>
        {create && (
          <Input
            label="Category for new dishes"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            wrapClassName="min-w-[12rem]"
          />
        )}
        <Button
          type="submit"
          disabled={!valid}
          loading={busy}
          icon={<RefreshCw className="h-4 w-4" />}
          className="ml-auto"
        >
          Push to {targets.length} branch{targets.length === 1 ? '' : 'es'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {results && (
        <div className="sa-push-result" role="status">
          <p>
            ✅ Menu synchronized with {results.rows.filter((r) => r.status !== 'missing').length} of{' '}
            {results.rows.length} branches in {results.ms} ms
          </p>
          <ul>
            {results.rows.map((r) => {
              const b = branches.find((x) => x.id === r.restaurant_id);
              return (
                <li key={r.restaurant_id}>
                  <b>{b?.name}</b>:{' '}
                  {r.status === 'updated'
                    ? `updated${r.old_price !== null && priceNum !== null && b ? ` (${formatMoney(r.old_price, b.currency)} → ${formatMoney(priceNum, b.currency)})` : ''}`
                    : r.status === 'created'
                      ? 'dish added'
                      : 'dish not on this menu (tick "Add the dish…" to create it)'}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title="Push to branches?"
        message={`This changes "${name.trim()}" in ${targets.length} branch${targets.length === 1 ? '' : 'es'}${priceNum !== null ? ` to ${priceNum} (in each branch's own currency)` : ''}. Each change is recorded in the branch audit log.`}
        confirmLabel="Push now"
        onConfirm={run}
        onClose={() => setConfirm(false)}
      />
    </form>
  );
}
