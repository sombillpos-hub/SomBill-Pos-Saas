import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { nullIfEmpty, supplierSchema, type SupplierForm } from '@sombill/shared-types/schemas';
import { fetchSuppliers } from '@sombill/api-client/queries';
import { formatMoney } from '@sombill/shared-utils/format';
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Checkbox, Input, Textarea } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';

/** Supplier balance = value of stock actually received − amount paid on those POs. */
export function supplierBalances(pos: PurchaseOrder[], lines: PurchaseOrderItem[]) {
  const receivedByPo = new Map<string, number>();
  for (const l of lines)
    receivedByPo.set(
      l.purchase_order_id,
      (receivedByPo.get(l.purchase_order_id) ?? 0) + Number(l.quantity_received) * Number(l.unit_cost),
    );
  const out = new Map<string, { orders: number; purchased: number; paid: number; balance: number }>();
  for (const po of pos) {
    if (po.status === 'draft' || po.status === 'cancelled') continue;
    const row = out.get(po.supplier_id) ?? { orders: 0, purchased: 0, paid: 0, balance: 0 };
    const rec = Math.round((receivedByPo.get(po.id) ?? 0) * 100) / 100;
    row.orders += 1;
    row.purchased += rec;
    row.paid += Number(po.amount_paid);
    row.balance = Math.round((row.purchased - row.paid) * 100) / 100;
    out.set(po.supplier_id, row);
  }
  return out;
}

export default function SuppliersPage() {
  const r = useRestaurant();
  const toast = useToast();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Supplier | null>(null);

  const q = useQuery(async () => {
    const [suppliers, pos, lines] = await Promise.all([
      fetchSuppliers(r.id),
      fetchAll<PurchaseOrder>((a, b) =>
        supabase.from('purchase_orders').select('*').eq('restaurant_id', r.id).order('id').range(a, b),
      ),
      fetchAll<PurchaseOrderItem>((a, b) =>
        supabase.from('purchase_order_items').select('*').eq('restaurant_id', r.id).order('id').range(a, b),
      ),
    ]);
    return { suppliers, balances: supplierBalances(pos, lines) };
  }, [r.id]);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (q.data?.suppliers ?? [])
      .filter((s) => (showArchived ? !!s.archived_at : !s.archived_at))
      .filter((s) => !t || [s.name, s.contact_person, s.phone, s.email].some((v) => v?.toLowerCase().includes(t)));
  }, [q.data, search, showArchived]);

  const setArchived = async (s: Supplier, archived: boolean) => {
    unwrap(
      await supabase
        .from('suppliers')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', s.id)
        .select('id')
        .single(),
    );
    toast.success(`${s.name} ${archived ? 'archived' : 'restored'}.`);
    setArchiveTarget(null);
    await q.reload();
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      cell: (s) => (
        <div>
          <p className="font-semibold">{s.name}</p>
          <p className="text-xs text-slate-500">{s.contact_person ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (s) => (
        <div className="text-sm">
          {s.phone ?? '—'}
          <p className="text-xs text-slate-500">{s.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) =>
        s.archived_at ? (
          <Badge tone="gray">Archived</Badge>
        ) : (
          <Badge tone={s.is_active ? 'green' : 'red'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    { key: 'pos', header: 'Purchase orders', align: 'right', cell: (s) => q.data?.balances.get(s.id)?.orders ?? 0 },
    {
      key: 'purchased',
      header: 'Received value',
      align: 'right',
      cell: (s) => money(q.data?.balances.get(s.id)?.purchased ?? 0),
    },
    {
      key: 'balance',
      header: 'Outstanding',
      align: 'right',
      cell: (s) => {
        const b = q.data?.balances.get(s.id)?.balance ?? 0;
        return b > 0 ? <Badge tone="red">{money(b)}</Badge> : money(b);
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!s.archived_at && (
            <IconBtn label="Edit" onClick={() => setEditing(s)}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
          )}
          {s.archived_at ? (
            <IconBtn
              label="Restore"
              onClick={() => void setArchived(s, false).catch((e) => toast.error(friendlyError(e)))}
            >
              <ArchiveRestore className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Archive" onClick={() => setArchiveTarget(s)}>
              <Archive className="h-4 w-4" />
            </IconBtn>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Supply Chain · Vendors"
        title="Suppliers"
        description="Vendors you buy ingredients and stock from."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New supplier
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers" className="sm:w-80" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="accent-brand-red"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />{' '}
            Show archived
          </label>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
          empty={
            <EmptyState
              title="No suppliers"
              action={
                !showArchived ? (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                    New supplier
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>
      {editing && (
        <SupplierModal
          supplier={editing === 'new' ? null : editing}
          restaurantId={r.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await q.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!archiveTarget}
        danger
        confirmLabel="Archive"
        title={`Archive ${archiveTarget?.name}?`}
        message="Archived suppliers cannot be used on new purchase orders. History is kept."
        onConfirm={async () => {
          if (archiveTarget) await setArchived(archiveTarget, true);
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

export function SupplierModal({
  supplier,
  restaurantId,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      contact_person: supplier?.contact_person ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      address: supplier?.address ?? '',
      notes: supplier?.notes ?? '',
      is_active: supplier?.is_active ?? true,
    },
  });
  const submit = async (raw: SupplierForm) => {
    const v = supplierSchema.parse(raw);
    setServerError(null);
    const row = {
      name: v.name,
      contact_person: nullIfEmpty(v.contact_person),
      phone: nullIfEmpty(v.phone),
      email: nullIfEmpty(v.email)?.toLowerCase() ?? null,
      address: nullIfEmpty(v.address),
      notes: nullIfEmpty(v.notes),
      is_active: v.is_active,
    };
    try {
      if (supplier) unwrap(await supabase.from('suppliers').update(row).eq('id', supplier.id).select('id').single());
      else
        unwrap(
          await supabase
            .from('suppliers')
            .insert({ ...row, restaurant_id: restaurantId })
            .select('id')
            .single(),
        );
      toast.success(`${v.name} saved.`);
      await onSaved();
    } catch (e) {
      const m = friendlyError(e);
      if (/already exists/.test(m)) setError('name', { message: m });
      else setServerError(m);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? `Edit ${supplier.name}` : 'New supplier'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="Supplier name"
          {...register('name')}
          error={errors.name?.message}
          required
          wrapClassName="sm:col-span-2"
        />
        <Input label="Contact person" {...register('contact_person')} error={errors.contact_person?.message} />
        <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Address" {...register('address')} error={errors.address?.message} />
        <Textarea
          label="Notes"
          {...register('notes')}
          error={errors.notes?.message}
          wrapClassName="sm:col-span-2"
          hint="Payment terms, delivery days…"
        />
        <Checkbox label="Active supplier" {...register('is_active')} />
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
