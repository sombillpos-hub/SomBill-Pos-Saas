import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDownUp,
  Boxes,
  Download,
  Pencil,
  Plus,
  Scale,
} from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import {
  inventoryItemSchema,
  nullIfEmpty,
  stockOperationSchema,
  type InventoryItemForm,
  type StockOperationForm,
} from '@sombill/shared-types/schemas';
import { fetchInventory, fetchSuppliers } from '@sombill/api-client/queries';
import { inventoryValuation } from '@sombill/shared-utils/reports';
import { presetRange, rangeToIso, type DateRange } from '@sombill/shared-utils/dates';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { formatDate, formatDateTime, formatMoney, formatQty, MOVEMENT_LABEL } from '@sombill/shared-utils/format';
import type { InventoryItem, StockMovement, StockMovementType, Supplier } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState, StatCard } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column } from '@sombill/shared-ui/ui/DataTable';
import { DateRangeFilter, SearchInput, Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';

const PAGE = 25;

export default function InventoryPage() {
  const r = useRestaurant();
  const toast = useToast();
  const money = (n: number) => formatMoney(n, r.currency);
  const [tab, setTab] = useState<'items' | 'movements'>('items');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'archived'>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [operating, setOperating] = useState<InventoryItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<InventoryItem | null>(null);

  const q = useQuery(async () => {
    const [items, suppliers] = await Promise.all([fetchInventory(r.id), fetchSuppliers(r.id)]);
    return { items, suppliers };
  }, [r.id]);
  useRealtime(['inventory_items'], r.id, () => void q.reload());

  const val = useMemo(() => inventoryValuation(q.data?.items ?? []), [q.data]);
  const lowIds = new Set(val.lowStock.map((i) => i.id));
  const cats = [...new Set((q.data?.items ?? []).map((i) => i.category).filter(Boolean))] as string[];
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (q.data?.items ?? [])
      .filter((i) =>
        stockFilter === 'archived' ? !!i.archived_at : !i.archived_at && (stockFilter !== 'low' || lowIds.has(i.id)),
      )
      .filter((i) => !cat || i.category === cat)
      .filter((i) => !t || [i.name, i.sku, i.category, i.location].some((v) => v?.toLowerCase().includes(t)));
  }, [q.data, search, cat, stockFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const supplierName = (id: string | null) => q.data?.suppliers.find((s) => s.id === id)?.name ?? '—';
  const setArchived = async (i: InventoryItem, archived: boolean) => {
    unwrap(
      await supabase
        .from('inventory_items')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', i.id)
        .select('id')
        .single(),
    );
    toast.success(`${i.name} ${archived ? 'archived' : 'restored'}.`);
    setArchiveTarget(null);
    await q.reload();
  };

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Item',
      cell: (i) => (
        <div>
          <p className="font-semibold">{i.name}</p>
          <p className="text-xs text-slate-500">
            {i.sku ?? 'No SKU'}
            {i.category ? ` · ${i.category}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'On hand',
      align: 'right',
      cell: (i) => (
        <span className="inline-flex items-center gap-1.5">
          {lowIds.has(i.id) && <AlertTriangle className="h-3.5 w-3.5 text-brand-orange" aria-label="Low stock" />}
          <b className={i.quantity <= 0 ? 'text-brand-red' : ''}>{formatQty(i.quantity)}</b> {i.unit}
        </span>
      ),
    },
    { key: 'min', header: 'Minimum', align: 'right', cell: (i) => `${formatQty(i.min_stock)} ${i.unit}` },
    { key: 'cost', header: 'Unit cost', align: 'right', cell: (i) => money(i.unit_cost) },
    { key: 'value', header: 'Value', align: 'right', cell: (i) => money(Math.max(i.quantity, 0) * i.unit_cost) },
    { key: 'supplier', header: 'Supplier', cell: (i) => supplierName(i.supplier_id) },
    {
      key: 'expiry',
      header: 'Expiry',
      cell: (i) => {
        if (!i.expiry_date) return '—';
        const days = Math.ceil((Date.parse(i.expiry_date) - Date.now()) / 86400000);
        return <Badge tone={days < 0 ? 'red' : days <= 7 ? 'orange' : 'gray'}>{formatDate(i.expiry_date)}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) => (
        <div className="flex justify-end gap-1">
          {!i.archived_at && (
            <IconBtn label="Stock operation" onClick={() => setOperating(i)}>
              <ArrowDownUp className="h-4 w-4" />
            </IconBtn>
          )}
          {!i.archived_at && (
            <IconBtn label="Edit" onClick={() => setEditing(i)}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
          )}
          {i.archived_at ? (
            <IconBtn
              label="Restore"
              onClick={() => void setArchived(i, false).catch((e) => toast.error(friendlyError(e)))}
            >
              <ArchiveRestore className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Archive" onClick={() => setArchiveTarget(i)}>
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
        eyebrow="Supply Chain · Stock Control"
        title="Inventory"
        description="Every stock change is recorded as a movement. Quantities can only change through receiving, adjustments, wastage, transfers or sales."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New item
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          loading={q.loading && !q.data}
          icon={<Scale className="h-5 w-5" />}
          label="Inventory valuation"
          value={money(val.value)}
          sub="Quantity × weighted average cost"
        />
        <StatCard
          loading={q.loading && !q.data}
          tone="orange"
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Low-stock items"
          value={val.lowStock.length}
        />
        <StatCard
          loading={q.loading && !q.data}
          tone="red"
          icon={<Boxes className="h-5 w-5" />}
          label="Out of stock"
          value={val.outOfStock}
        />
      </div>
      <Card bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'items', label: 'Items' },
              { id: 'movements', label: 'Stock movements' },
            ]}
          />
        </div>
        {tab === 'items' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search items"
                className="lg:w-72"
              />
              <select
                className="input lg:w-48"
                aria-label="Category"
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All categories</option>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="input lg:ml-auto lg:w-48"
                aria-label="Stock filter"
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as typeof stockFilter);
                  setPage(1);
                }}
              >
                <option value="all">All active items</option>
                <option value="low">Low stock only</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <DataTable
              columns={columns}
              rows={rows.slice((page - 1) * PAGE, page * PAGE)}
              rowKey={(i) => i.id}
              loading={q.loading && !q.data}
              error={q.error}
              onRetry={q.reload}
              empty={
                <EmptyState
                  title="No inventory items"
                  message="Add ingredients and stock items to track quantities and costs."
                  action={
                    stockFilter === 'all' && !search ? (
                      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                        New item
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
            <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </>
        ) : (
          <MovementsTab items={q.data?.items ?? []} />
        )}
      </Card>

      {editing && q.data && (
        <ItemModal
          item={editing === 'new' ? null : editing}
          suppliers={q.data.suppliers}
          all={q.data.items}
          restaurantId={r.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await q.reload();
          }}
        />
      )}
      {operating && q.data && (
        <StockOperationModal
          item={operating}
          items={q.data.items}
          currency={r.currency}
          allowNegative={r.settings.inventory.allow_negative_stock}
          onClose={() => setOperating(null)}
          onDone={async () => {
            setOperating(null);
            await q.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!archiveTarget}
        danger
        confirmLabel="Archive"
        title={`Archive ${archiveTarget?.name}?`}
        message="Archived items are hidden from recipes and purchasing. Their movement history is kept."
        onConfirm={async () => {
          if (archiveTarget) await setArchived(archiveTarget, true);
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function MovementsTab({ items }: { items: InventoryItem[] }) {
  const r = useRestaurant();
  const staff = useStaffDirectory(r.id);
  const [range, setRange] = useState<DateRange>(() => presetRange('last7', r.timezone));
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState<'' | StockMovementType>('');
  const [page, setPage] = useState(1);
  const q = useQuery(async () => {
    const { fromIso, toIso } = rangeToIso(range, r.timezone);
    return fetchAll<StockMovement>((a, b) => {
      let x = supabase
        .from('stock_movements')
        .select('*')
        .eq('restaurant_id', r.id)
        .gte('created_at', fromIso)
        .lt('created_at', toIso);
      if (itemId) x = x.eq('inventory_item_id', itemId);
      if (type) x = x.eq('movement_type', type);
      return x.order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b);
    });
  }, [r.id, range.from, range.to, itemId, type]);
  const itemOf = (id: string) => items.find((i) => i.id === id);
  const rows = q.data ?? [];
  const columns: Column<StockMovement>[] = [
    {
      key: 'when',
      header: 'When',
      cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.created_at, r.timezone)}</span>,
    },
    { key: 'item', header: 'Item', cell: (m) => itemOf(m.inventory_item_id)?.name ?? '—' },
    {
      key: 'type',
      header: 'Type',
      cell: (m) => <Badge tone={m.quantity_change > 0 ? 'green' : 'red'}>{MOVEMENT_LABEL[m.movement_type]}</Badge>,
    },
    {
      key: 'chg',
      header: 'Change',
      align: 'right',
      cell: (m) => (
        <b className={m.quantity_change > 0 ? 'text-emerald-700' : 'text-brand-red'}>
          {m.quantity_change > 0 ? '+' : ''}
          {formatQty(m.quantity_change)}
        </b>
      ),
    },
    {
      key: 'after',
      header: 'Balance',
      align: 'right',
      cell: (m) => `${formatQty(m.quantity_after)} ${itemOf(m.inventory_item_id)?.unit ?? ''}`,
    },
    {
      key: 'reason',
      header: 'Reason / reference',
      cell: (m) => <span className="text-slate-600">{m.reason ?? '—'}</span>,
    },
    { key: 'by', header: 'By', cell: (m) => staff.nameOf(m.created_by) },
  ];
  const exportCsv = () =>
    downloadCsv(
      `stock_movements_${range.from}_${range.to}`,
      ['Date', 'Item', 'Type', 'Change', 'Balance after', 'Unit', 'Unit cost', 'Reason', 'Reference type', 'By'],
      rows.map((m) => [
        formatDateTime(m.created_at, r.timezone),
        itemOf(m.inventory_item_id)?.name,
        MOVEMENT_LABEL[m.movement_type],
        m.quantity_change,
        m.quantity_after,
        itemOf(m.inventory_item_id)?.unit,
        m.unit_cost,
        m.reason,
        m.reference_type,
        staff.nameOf(m.created_by),
      ]),
    );
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center">
        <DateRangeFilter
          value={range}
          onChange={(v) => {
            setRange(v);
            setPage(1);
          }}
          timeZone={r.timezone}
        />
        <select
          className="input xl:w-52"
          aria-label="Item"
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All items</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          className="input xl:w-44"
          aria-label="Movement type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as StockMovementType | '');
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {(Object.keys(MOVEMENT_LABEL) as StockMovementType[]).map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABEL[t]}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          className="xl:ml-auto"
          icon={<Download className="h-4 w-4" />}
          onClick={exportCsv}
          disabled={!rows.length}
        >
          Export CSV
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows.slice((page - 1) * PAGE, page * PAGE)}
        rowKey={(m) => String(m.id)}
        loading={q.loading && !q.data}
        error={q.error}
        onRetry={q.reload}
        empty={<EmptyState title="No stock movements in this period" />}
      />
      <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
    </>
  );
}

function ItemModal({
  item,
  suppliers,
  all,
  restaurantId,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  suppliers: Supplier[];
  all: InventoryItem[];
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
  } = useForm<InventoryItemForm>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: item?.name ?? '',
      sku: item?.sku ?? '',
      category: item?.category ?? '',
      unit: item?.unit ?? 'kg',
      quantity: item?.quantity ?? 0,
      unit_cost: item?.unit_cost ?? 0,
      min_stock: item?.min_stock ?? 0,
      supplier_id: item?.supplier_id ?? '',
      expiry_date: item?.expiry_date ?? '',
      location: item?.location ?? '',
    },
  });
  const submit = async (raw: InventoryItemForm) => {
    const v = inventoryItemSchema.parse(raw);
    setServerError(null);
    const sku = nullIfEmpty(v.sku);
    if (sku && all.some((i) => i.id !== item?.id && !i.archived_at && i.sku?.toLowerCase() === sku.toLowerCase())) {
      setError('sku', { message: 'SKU already used by another item' });
      return;
    }
    const base = {
      name: v.name,
      sku,
      category: nullIfEmpty(v.category),
      unit: v.unit,
      min_stock: v.min_stock,
      supplier_id: v.supplier_id || null,
      expiry_date: v.expiry_date || null,
      location: nullIfEmpty(v.location),
    };
    try {
      if (item)
        unwrap(
          await supabase
            .from('inventory_items')
            .update({ ...base, unit_cost: v.unit_cost })
            .eq('id', item.id)
            .select('id')
            .single(),
        );
      else
        unwrap(
          await supabase
            .from('inventory_items')
            .insert({ ...base, restaurant_id: restaurantId, quantity: v.quantity, unit_cost: v.unit_cost })
            .select('id')
            .single(),
        );
      toast.success(`${v.name} saved.`);
      await onSaved();
    } catch (e) {
      setServerError(friendlyError(e));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item ? `Edit ${item.name}` : 'New inventory item'}
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
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-1 gap-4 sm:grid-cols-3" noValidate>
        <Input
          label="Ingredient / item name"
          {...register('name')}
          error={errors.name?.message}
          required
          wrapClassName="sm:col-span-2"
        />
        <Input label="SKU" {...register('sku')} error={errors.sku?.message} />
        <Input
          label="Category"
          {...register('category')}
          error={errors.category?.message}
          placeholder="Meat, Dry goods, Drinks…"
        />
        <Select label="Unit" {...register('unit')}>
          {['kg', 'g', 'l', 'ml', 'pcs', 'box', 'bag', 'bottle', 'can', 'dozen'].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <Input label="Storage location" {...register('location')} error={errors.location?.message} />
        {item ? (
          <div>
            <span className="label">On hand</span>
            <p className="input bg-slate-50">
              {formatQty(item.quantity)} {item.unit}
            </p>
            <p className="mt-1 text-xs text-slate-500">Use a stock operation to change quantity</p>
          </div>
        ) : (
          <Input
            label="Opening quantity"
            type="number"
            step="0.001"
            min="0"
            {...register('quantity')}
            error={errors.quantity?.message}
            hint="Recorded as an opening stock movement"
          />
        )}
        <Input
          label="Purchase cost per unit"
          type="number"
          step="0.0001"
          min="0"
          {...register('unit_cost')}
          error={errors.unit_cost?.message}
        />
        <Input
          label="Minimum stock"
          type="number"
          step="0.001"
          min="0"
          {...register('min_stock')}
          error={errors.min_stock?.message}
          hint="Alert when at or below"
        />
        <Select label="Preferred supplier" {...register('supplier_id')} wrapClassName="sm:col-span-2">
          <option value="">None</option>
          {suppliers
            .filter((s) => !s.archived_at)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        <Input label="Expiry date" type="date" {...register('expiry_date')} error={errors.expiry_date?.message} />
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-3">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}

function StockOperationModal({
  item,
  items,
  currency,
  allowNegative,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  items: InventoryItem[];
  currency: string;
  allowNegative: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StockOperationForm>({
    resolver: zodResolver(stockOperationSchema),
    defaultValues: { type: 'receive', quantity: 0, unit_cost: item.unit_cost, reason: '', target_item_id: '' },
  });
  const type = watch('type');
  const qty = Number(watch('quantity')) || 0;
  const delta = type === 'receive' ? qty : type === 'adjustment' ? qty : -qty;
  const after = item.quantity + delta;

  const submit = async (raw: StockOperationForm) => {
    const v = stockOperationSchema.parse(raw);
    setServerError(null);
    if (!allowNegative && after < 0) {
      setError('quantity', { message: `Only ${formatQty(item.quantity)} ${item.unit} on hand` });
      return;
    }
    const res =
      v.type === 'transfer'
        ? await supabase.rpc('transfer_stock', {
            p_from: item.id,
            p_to: v.target_item_id,
            p_quantity: v.quantity,
            p_reason: v.reason,
          })
        : await supabase.rpc('adjust_stock', {
            p_item: item.id,
            p_type: v.type,
            p_quantity: v.quantity,
            p_reason: v.reason,
            p_unit_cost: v.type === 'receive' && v.unit_cost !== '' ? v.unit_cost : null,
          });
    if (res.error) {
      setServerError(friendlyError(res.error));
      return;
    }
    toast.success(`Stock updated for ${item.name}.`);
    await onDone();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Stock operation · ${item.name}`}
      description={`On hand: ${formatQty(item.quantity)} ${item.unit}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={isSubmitting}>
            Record movement
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-2 gap-4" noValidate>
        <Select label="Operation" {...register('type')} wrapClassName="col-span-2">
          <option value="receive">Receive stock (add)</option>
          <option value="wastage">Wastage / spoilage (remove)</option>
          <option value="adjustment">Adjustment after count (+ / −)</option>
          <option value="transfer">Transfer to another item</option>
        </Select>
        <Input
          label={type === 'adjustment' ? `Change (${item.unit}, negative to reduce)` : `Quantity (${item.unit})`}
          type="number"
          step="0.001"
          {...register('quantity')}
          error={errors.quantity?.message}
        />
        {type === 'receive' && (
          <Input
            label={`Unit cost (${currency})`}
            type="number"
            step="0.0001"
            min="0"
            {...register('unit_cost')}
            error={errors.unit_cost?.message}
            hint="Updates weighted average cost"
          />
        )}
        {type === 'transfer' && (
          <Select label="Destination item" {...register('target_item_id')} error={errors.target_item_id?.message}>
            <option value="">Choose…</option>
            {items
              .filter((i) => i.id !== item.id && !i.archived_at && i.unit === item.unit)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </Select>
        )}
        <Textarea
          label="Reason"
          {...register('reason')}
          error={errors.reason?.message}
          wrapClassName="col-span-2"
          placeholder="e.g. Delivery from market, spoiled, monthly count…"
        />
        <p className="col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
          New balance:{' '}
          <b className={after < 0 ? 'text-brand-red' : ''}>
            {formatQty(after)} {item.unit}
          </b>
        </p>
        {serverError && (
          <p role="alert" className="col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
