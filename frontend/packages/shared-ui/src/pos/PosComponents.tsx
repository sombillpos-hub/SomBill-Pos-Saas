import { useState, type ReactNode } from 'react';
import { ImageOff, UserPlus, X } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { customerSchema, nullIfEmpty } from '@sombill/shared-types/schemas';
import { cn } from '@sombill/shared-utils/cn';
import type { Customer, Product } from '@sombill/shared-types/types';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useToast } from '@sombill/shared-ui/ui/Toast';

// Shared building blocks for the Waiter and Cashier POS screens.

export function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-sb="cat-chip"
      onClick={onClick}
      className={cn(
        'h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
        active
          ? 'border-brand-navy bg-brand-navy text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-brand-navy',
      )}
    >
      {children}
    </button>
  );
}

export function ProductCard({
  p,
  money,
  onAdd,
  qty,
  disabled,
}: {
  p: Product;
  money: (n: number) => string;
  onAdd: () => void;
  qty: number;
  disabled: boolean;
}) {
  const unavailable = !p.is_available;
  return (
    <button
      type="button"
      role="listitem"
      data-sb="product-card"
      onClick={onAdd}
      disabled={unavailable || disabled}
      aria-label={`Add ${p.name}, ${money(p.price)}${unavailable ? ', unavailable' : ''}`}
      className={cn(
        'relative flex min-h-[96px] items-center gap-3 rounded-xl border bg-white p-2.5 text-left transition-shadow',
        unavailable || disabled
          ? 'cursor-not-allowed border-slate-200 opacity-50'
          : 'border-slate-200 hover:border-brand-orange hover:shadow-md active:scale-[0.99]',
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
        {p.image_url ? (
          <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <ImageOff className="h-5 w-5 text-slate-300" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold leading-tight text-brand-text">{p.name}</span>
        <span data-sb="price" className="mt-1 block text-sm font-bold tabular-nums text-brand-navy">
          {money(p.price)}
        </span>
        {unavailable && <span className="text-xs font-semibold text-red-600">Unavailable</span>}
      </span>
      {qty > 0 && (
        <span
          data-sb="qty-badge"
          className="absolute right-1.5 top-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-bold text-white"
        >
          {qty}
        </span>
      )}
    </button>
  );
}

export function CustomerPicker({
  value,
  onChange,
  canCreate,
  label = 'Customer (optional)',
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  canCreate: boolean;
  label?: string;
}) {
  const r = useRestaurant();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const selected = useQuery(
    async () =>
      value
        ? (unwrap(await supabase.from('customers').select('*').eq('id', value).maybeSingle()) as Customer | null)
        : null,
    [value],
  );
  const results = useQuery(async () => {
    const t = term.trim().replace(/[%,()]/g, '');
    if (t.length < 2) return [] as Customer[];
    return unwrap(
      await supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', r.id)
        .is('archived_at', null)
        .or(`name.ilike.%${t}%,phone.ilike.%${t}%`)
        .limit(6),
    ) as Customer[];
  }, [term, r.id]);

  if (value && selected.data) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <b>{selected.data.name}</b>
          {selected.data.phone ? ` · ${selected.data.phone}` : ''}
        </span>
        <button
          type="button"
          className="rounded p-1.5 text-slate-500 hover:bg-white"
          aria-label="Remove customer"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input
          className="input h-11"
          placeholder="Search name or phone"
          aria-label="Search customer"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          maxLength={60}
        />
        {canCreate && (
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50"
            aria-label="New customer"
            onClick={() => setCreating(true)}
          >
            <UserPlus className="h-5 w-5" />
          </button>
        )}
      </div>
      {(results.data?.length ?? 0) > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.data!.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-orange-50"
                onClick={() => {
                  onChange(c.id);
                  setTerm('');
                }}
              >
                {c.name}
                <span className="ml-2 text-xs text-slate-500">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <NewCustomerModal
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            onChange(c.id);
            setCreating(false);
            toast.success(`${c.name} added.`);
          }}
        />
      )}
    </div>
  );
}

function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Customer) => void }) {
  const r = useRestaurant();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const parsed = customerSchema.safeParse({ name, phone, email: '', address: '', notes: '' });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setBusy(true);
    try {
      const c = unwrap(
        await supabase
          .from('customers')
          .insert({ restaurant_id: r.id, name: parsed.data.name, phone: nullIfEmpty(phone) })
          .select('*')
          .single(),
      ) as Customer;
      onCreated(c);
    } catch (e) {
      setErrors({ form: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="New customer"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Name"
          name="cust-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="Phone"
          name="cust-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          placeholder="+252 63 …"
        />
        {errors.form && (
          <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
            {errors.form}
          </p>
        )}
        <p className="text-xs text-slate-500">Need to change customer details later? Ask a manager.</p>
      </div>
    </Modal>
  );
}
