import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { nullIfEmpty, purchaseOrderSchema, type PurchaseOrderForm } from '@sombill/shared-types/schemas';
import { fetchInventory, fetchSuppliers } from '@sombill/api-client/queries';
import { formatDate, formatDateTime, formatMoney, PO_STATUS_LABEL } from '@sombill/shared-utils/format';
import type { InventoryItem, POStatus, PurchaseOrder, PurchaseOrderItem, Supplier } from '@sombill/shared-types/types';
import { Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput, Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { POStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { useToast } from '@sombill/shared-ui/ui/Toast';

const PAGE = 20;
type Tab = 'all' | POStatus;

export default function PurchaseOrdersPage() {
  const r = useRestaurant();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const money = (n: number) => formatMoney(n, r.currency);

  const q = useQuery(async () => {
    const [pos, suppliers, inventory] = await Promise.all([
      fetchAll<PurchaseOrder>((a, b) =>
        supabase
          .from('purchase_orders')
          .select('*')
          .eq('restaurant_id', r.id)
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
      fetchSuppliers(r.id),
      fetchInventory(r.id),
    ]);
    return { pos, suppliers, inventory };
  }, [r.id]);

  const supplierName = (id: string) => q.data?.suppliers.find((s) => s.id === id)?.name ?? '—';
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/^po-?/, '');
    return (q.data?.pos ?? [])
      .filter((p) => tab === 'all' || p.status === tab)
      .filter((p) => !t || String(p.po_number) === t || supplierName(p.supplier_id).toLowerCase().includes(t));
  }, [q.data, tab, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (s: Tab) =>
    s === 'all' ? (q.data?.pos.length ?? 0) : (q.data?.pos.filter((p) => p.status === s).length ?? 0);

  const columns: Column<PurchaseOrder>[] = [
    { key: 'no', header: 'PO', cell: (p) => <b>PO-{p.po_number}</b> },
    { key: 'sup', header: 'Supplier', cell: (p) => supplierName(p.supplier_id) },
    {
      key: 'created',
      header: 'Created',
      cell: (p) => <span className="whitespace-nowrap">{formatDateTime(p.created_at, r.timezone)}</span>,
    },
    { key: 'exp', header: 'Expected', cell: (p) => formatDate(p.expected_date) },
    { key: 'status', header: 'Status', cell: (p) => <POStatusBadge s={p.status} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (p) => money(p.total) },
  ];

  const closeCreate = () => {
    setCreating(false);
    if (params.get('new')) setParams({});
  };

  return (
    <div>
      <PageHeader
        eyebrow="Supply Chain · Purchasing"
        title="Purchase Orders"
        description="Order stock from suppliers. Inventory increases only when goods are received."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New purchase order
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="PO number or supplier"
            className="sm:w-80"
          />
        </div>
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            tabs={(['all', 'draft', 'ordered', 'partially_received', 'received', 'cancelled'] as Tab[]).map((s) => ({
              id: s,
              label: s === 'all' ? 'All' : PO_STATUS_LABEL[s],
              count: count(s),
            }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows.slice((page - 1) * PAGE, page * PAGE)}
          rowKey={(p) => p.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          onRowClick={(p) => navigate(`/purchase-orders/${p.id}`)}
          empty={
            <EmptyState
              title="No purchase orders"
              action={
                tab === 'all' ? (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                    New purchase order
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
      </Card>
      {creating && q.data && (
        <POFormModal
          suppliers={q.data.suppliers}
          inventory={q.data.inventory}
          restaurantId={r.id}
          currency={r.currency}
          defaultSupplier={params.get('supplier') ?? ''}
          onClose={closeCreate}
          onSaved={(id) => {
            closeCreate();
            navigate(`/purchase-orders/${id}`);
          }}
        />
      )}
    </div>
  );
}

export function POFormModal({
  po,
  lines: existingLines,
  suppliers,
  inventory,
  restaurantId,
  currency,
  defaultSupplier = '',
  onClose,
  onSaved,
}: {
  po?: PurchaseOrder;
  lines?: PurchaseOrderItem[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  restaurantId: string;
  currency: string;
  defaultSupplier?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderForm>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplier_id: po?.supplier_id ?? defaultSupplier,
      expected_date: po?.expected_date ?? '',
      notes: po?.notes ?? '',
      lines: existingLines?.length
        ? existingLines.map((l) => ({
            inventory_item_id: l.inventory_item_id,
            quantity_ordered: l.quantity_ordered,
            unit_cost: l.unit_cost,
          }))
        : [{ inventory_item_id: '', quantity_ordered: 1, unit_cost: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');
  const supplierId = watch('supplier_id');
  const total = lines.reduce((s, l) => s + (Number(l.quantity_ordered) || 0) * (Number(l.unit_cost) || 0), 0);
  const active = inventory.filter((i) => !i.archived_at);
  const preferred = active.filter((i) => i.supplier_id === supplierId);

  useEffect(() => {
    // Pre-fill unit cost from the item's current average cost when an item is picked.
    lines.forEach((l, idx) => {
      const it = active.find((i) => i.id === l.inventory_item_id);
      if (it && Number(l.unit_cost) === 0 && it.unit_cost > 0) setValue(`lines.${idx}.unit_cost`, it.unit_cost);
    });
  }, [lines.map((l) => l.inventory_item_id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (raw: PurchaseOrderForm, status: 'draft' | 'ordered') => {
    const v = purchaseOrderSchema.parse(raw);
    setServerError(null);
    try {
      let id = po?.id;
      const header = {
        supplier_id: v.supplier_id,
        expected_date: v.expected_date || null,
        notes: nullIfEmpty(v.notes),
      };
      if (!id) {
        id = (
          unwrap(
            await supabase
              .from('purchase_orders')
              .insert({ ...header, restaurant_id: restaurantId, status: 'draft' })
              .select('id')
              .single(),
          ) as { id: string }
        ).id;
      } else {
        unwrap(await supabase.from('purchase_orders').update(header).eq('id', id).select('id').single());
        const keep = new Set(v.lines.map((l) => l.inventory_item_id));
        const drop = (existingLines ?? []).filter((l) => !keep.has(l.inventory_item_id));
        if (drop.length)
          unwrap(
            await supabase
              .from('purchase_order_items')
              .delete()
              .in(
                'id',
                drop.map((d) => d.id),
              )
              .select('id'),
          );
      }
      unwrap(
        await supabase
          .from('purchase_order_items')
          .upsert(
            v.lines.map((l) => ({
              restaurant_id: restaurantId,
              purchase_order_id: id,
              inventory_item_id: l.inventory_item_id,
              quantity_ordered: l.quantity_ordered,
              unit_cost: l.unit_cost,
            })),
            { onConflict: 'purchase_order_id,inventory_item_id' },
          )
          .select('id'),
      );
      if (status === 'ordered')
        unwrap(await supabase.from('purchase_orders').update({ status: 'ordered' }).eq('id', id).select('id').single());
      toast.success(status === 'ordered' ? 'Purchase order placed.' : 'Draft saved.');
      onSaved(id!);
    } catch (e) {
      setServerError(friendlyError(e));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={po ? `Edit PO-${po.po_number}` : 'New purchase order'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSubmit((v) => save(v, 'draft'))} loading={isSubmitting}>
            Save draft
          </Button>
          <Button onClick={handleSubmit((v) => save(v, 'ordered'))} loading={isSubmitting}>
            Place order
          </Button>
        </>
      }
    >
      <form className="space-y-5" noValidate onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Supplier" {...register('supplier_id')} error={errors.supplier_id?.message} required>
            <option value="">Choose a supplier…</option>
            {suppliers
              .filter((s) => (!s.archived_at && s.is_active) || s.id === po?.supplier_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
          <Input label="Expected delivery" type="date" {...register('expected_date')} />
          <Textarea label="Notes" {...register('notes')} rows={1} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Items</span>
            {preferred.length > 0 && (
              <span className="text-xs text-slate-500">{preferred.length} item(s) list this supplier as preferred</span>
            )}
          </div>
          <div className="space-y-2">
            {fields.map((f, idx) => (
              <div key={f.id} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-12 sm:col-span-6">
                  <select className="input" aria-label="Item" {...register(`lines.${idx}.inventory_item_id`)}>
                    <option value="">Choose item…</option>
                    {preferred.length > 0 && (
                      <optgroup label="Preferred for this supplier">
                        {preferred.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All items">
                      {active.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {errors.lines?.[idx]?.inventory_item_id && (
                    <p className="mt-1 text-xs text-red-600">{errors.lines[idx]?.inventory_item_id?.message}</p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    className="input"
                    type="number"
                    step="0.001"
                    min="0"
                    aria-label="Quantity"
                    placeholder="Qty"
                    {...register(`lines.${idx}.quantity_ordered`)}
                  />
                  {errors.lines?.[idx]?.quantity_ordered && (
                    <p className="mt-1 text-xs text-red-600">{errors.lines[idx]?.quantity_ordered?.message}</p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    min="0"
                    aria-label="Unit cost"
                    placeholder="Unit cost"
                    {...register(`lines.${idx}.unit_cost`)}
                  />
                </div>
                <div className="col-span-3 flex h-10 items-center justify-end text-sm tabular-nums sm:col-span-1">
                  {formatMoney(
                    (Number(lines[idx]?.quantity_ordered) || 0) * (Number(lines[idx]?.unit_cost) || 0),
                    currency,
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Remove line"
                  className="col-span-1 flex h-10 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => remove(idx)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {typeof errors.lines?.message === 'string' && (
            <p className="mt-1 text-xs text-red-600">{errors.lines.message}</p>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => append({ inventory_item_id: '', quantity_ordered: 1, unit_cost: 0 })}
          >
            Add line
          </Button>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-3 text-base font-bold text-brand-navy">
          Total: {formatMoney(total, currency)}
        </div>
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
