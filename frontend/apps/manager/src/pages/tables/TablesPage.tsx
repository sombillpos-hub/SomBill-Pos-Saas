import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  QrCode,
  Sparkles,
  Users,
} from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { nullIfEmpty, tableSchema, type TableForm } from '@sombill/shared-types/schemas';
import { fetchTables, fetchTableStatus } from '@sombill/api-client/queries';
import { formatDuration, formatMoney, TABLE_STATUS_LABEL } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { RestaurantTable, TableStatus, TableStatusRow } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState, ErrorState, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { TableStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';
import { buildTableMenuUrl, TableQrModal, type QrTableTarget } from './TableQrModal';

const STATUS_PILL_STYLE: Record<TableStatus, string> = {
  available: 'border-slate-200 bg-white text-slate-700',
  occupied: 'border-orange-300/80 bg-orange-50 text-orange-800',
  bill_requested: 'border-amber-300/80 bg-amber-50 text-amber-800',
  payment_pending: 'border-red-300/80 bg-red-50 text-red-800',
  cleaning: 'border-sky-300/80 bg-sky-50 text-sky-800',
};

const STATUS_BAR_STYLE: Record<TableStatus, string> = {
  available: 'from-slate-400 to-slate-500',
  occupied: 'from-[#ea580c] to-[#f97316]',
  bill_requested: 'from-[#d97706] to-[#fbbf24]',
  payment_pending: 'from-[#dc2626] to-[#ef4444]',
  cleaning: 'from-sky-500 to-cyan-400',
};

export default function TablesPage() {
  const r = useRestaurant();
  const toast = useToast();
  const staff = useStaffDirectory(r.id);
  const [view, setView] = useState<'floor' | 'list'>('floor');
  const [floor, setFloor] = useState('');
  const [editing, setEditing] = useState<RestaurantTable | 'new' | null>(null);
  const [qrTarget, setQrTarget] = useState<QrTableTarget | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RestaurantTable | null>(null);
  const [, setTick] = useState(0);

  const q = useQuery(async () => {
    const [tables, status] = await Promise.all([fetchTables(r.id), fetchTableStatus(r.id)]);
    return { tables, status };
  }, [r.id]);
  useRealtime(['orders', 'payments', 'restaurant_tables'], r.id, () => void q.reload());
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []); // refresh durations

  const floors = useMemo(() => [...new Set((q.data?.status ?? []).map((t) => t.floor))].sort(), [q.data]);
  useEffect(() => {
    if (floors.length && !floors.includes(floor)) setFloor(floors[0]!);
  }, [floors, floor]);
  const onFloor = (q.data?.status ?? []).filter((t) => t.floor === floor);
  const statusCounts = (q.data?.status ?? []).reduce<Record<string, number>>(
    (m, t) => ({ ...m, [t.status]: (m[t.status] ?? 0) + 1 }),
    {},
  );

  const setArchived = async (t: RestaurantTable, archived: boolean) => {
    if (archived && q.data?.status.find((s) => s.id === t.id)?.order_id)
      throw new Error('This table has an active order. Close it before archiving.');
    unwrap(
      await supabase
        .from('restaurant_tables')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', t.id)
        .select('id')
        .single(),
    );
    toast.success(`Table ${t.table_number} ${archived ? 'archived' : 'restored'}.`);
    setArchiveTarget(null);
    await q.reload();
  };
  const toggleCleaning = async (t: TableStatusRow) => {
    try {
      unwrap(
        await supabase
          .from('restaurant_tables')
          .update({ needs_cleaning: !t.needs_cleaning })
          .eq('id', t.id)
          .select('id')
          .single(),
      );
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const columns: Column<RestaurantTable>[] = [
    {
      key: 'no',
      header: 'Table',
      cell: (t) => (
        <span className="font-semibold">
          #{t.table_number}
          {t.name ? ` · ${t.name}` : ''}
        </span>
      ),
    },
    { key: 'cap', header: 'Seats', align: 'right', cell: (t) => t.capacity },
    { key: 'sec', header: 'Section', cell: (t) => t.section },
    { key: 'floor', header: 'Floor', cell: (t) => t.floor },
    {
      key: 'status',
      header: 'Status',
      cell: (t) => {
        if (t.archived_at) return <Badge tone="gray">Archived</Badge>;
        const s = q.data?.status.find((x) => x.id === t.id);
        return s ? <TableStatusBadge s={s.status} /> : '—';
      },
    },
    {
      key: 'qr',
      header: 'QR Menu',
      cell: (t) =>
        t.archived_at ? (
          '—'
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQrTarget(t)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700 transition hover:border-orange-400 hover:bg-orange-100"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR Code
            </button>
            <a
              href={buildTableMenuUrl(t, r.name)}
              target="_blank"
              rel="noreferrer"
              title={`Open customer menu for Table #${t.table_number}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (t) => (
        <div className="flex justify-end gap-1">
          {!t.archived_at && (
            <IconBtn label="Edit" onClick={() => setEditing(t)}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
          )}
          {t.archived_at ? (
            <IconBtn
              label="Restore"
              onClick={() => void setArchived(t, false).catch((e) => toast.error(friendlyError(e)))}
            >
              <ArchiveRestore className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Archive" onClick={() => setArchiveTarget(t)}>
              <Archive className="h-4 w-4" />
            </IconBtn>
          )}
        </div>
      ),
    },
  ];

  const firstActiveTable = q.data?.tables.find((t) => !t.archived_at);

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Dining Floor & QR Ordering"
        title="Tables & Floor Plans"
        description="Manage live floor status, generate scannable table QR codes, and preview the customer dining menu."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/15 bg-white/10 p-0.5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setView('floor')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                  view === 'floor' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Floor plan
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                  view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white',
                )}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>
            {firstActiveTable && (
              <a href={buildTableMenuUrl(firstActiveTable, r.name)} target="_blank" rel="noreferrer">
                <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
                  Customer Menu
                </Button>
              </a>
            )}
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              New table
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TABLE_STATUS_LABEL) as TableStatus[])
          .filter((s) => s !== 'cleaning' || r.settings.tables.cleaning_enabled)
          .map((s) => (
            <span
              key={s}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm',
                STATUS_PILL_STYLE[s],
              )}
            >
              <span className={cn('h-2 w-2 rounded-full bg-gradient-to-r', STATUS_BAR_STYLE[s])} aria-hidden />
              {TABLE_STATUS_LABEL[s]} <span className="font-mono tabular-nums">{statusCounts[s] ?? 0}</span>
            </span>
          ))}
      </div>

      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : view === 'list' ? (
        <Card bodyClassName="p-0">
          <DataTable
            columns={columns}
            rows={q.data?.tables ?? []}
            rowKey={(t) => t.id}
            loading={q.loading && !q.data}
            empty={
              <EmptyState
                title="No tables yet"
                action={
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                    New table
                  </Button>
                }
              />
            }
          />
        </Card>
      ) : q.loading && !q.data ? (
        <Skeleton className="h-96 w-full" />
      ) : !q.data?.status.length ? (
        <div className="card">
          <EmptyState
            icon={<LayoutGrid className="h-6 w-6" />}
            title="Design your floor plan"
            message="Add tables with their section, floor and grid position."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                New table
              </Button>
            }
          />
        </div>
      ) : (
        <Card bodyClassName="p-0">
          {floors.length > 1 && (
            <div className="border-b border-slate-100 px-4 pt-2 dark:border-white/10">
              <Tabs value={floor} onChange={setFloor} tabs={floors.map((f) => ({ id: f, label: f }))} />
            </div>
          )}
          <div
            className="p-4 sm:p-6"
            style={{
              backgroundImage: 'radial-gradient(rgba(249, 115, 22, 0.12) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {onFloor.map((t) => {
                const rawTable = q.data?.tables.find((x) => x.id === t.id) ?? null;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'group relative flex min-h-[168px] flex-col justify-between overflow-hidden border bg-white/95 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg dark:border-white/10 dark:bg-[#14080c]/90',
                      t.shape === 'round' ? 'rounded-3xl' : 'rounded-2xl',
                    )}
                  >
                    {/* Top status accent strip */}
                    <div
                      className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', STATUS_BAR_STYLE[t.status])}
                      aria-hidden
                    />

                    {/* Card header: Table # + seats */}
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-xl bg-gradient-to-br from-[#dc2626] to-[#f97316] px-2 font-mono text-sm font-black text-white shadow-sm">
                            {t.table_number}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                              {t.name ?? `Table #${t.table_number}`}
                            </p>
                            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {t.section} · {t.shape === 'round' ? 'Round' : t.shape === 'rect' ? 'Long' : 'Square'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        <Users className="h-3 w-3 text-orange-500" />
                        {t.capacity}
                      </span>
                    </div>

                    {/* Middle: live order details or clean status */}
                    {t.order_id ? (
                      <Link
                        to={`/manager/orders/${t.order_id}`}
                        className="mt-3 block rounded-xl border border-orange-200/70 bg-orange-50/70 p-2.5 text-xs transition hover:border-orange-400 dark:border-orange-500/25 dark:bg-orange-500/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            #{t.order_number} · {formatDuration(t.order_started_at)}
                          </span>
                          <span className="font-mono font-extrabold tabular-nums text-brand-red dark:text-amber-300">
                            {formatMoney(t.balance, r.currency)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">
                          {staff.nameOf(t.waiter_id)} · {TABLE_STATUS_LABEL[t.status]}
                        </p>
                      </Link>
                    ) : (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs dark:border-white/5 dark:bg-white/[0.03]">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {TABLE_STATUS_LABEL[t.status]}
                        </span>
                        {r.settings.tables.cleaning_enabled && (
                          <button
                            type="button"
                            onClick={() => void toggleCleaning(t)}
                            title={t.needs_cleaning ? 'Mark clean' : 'Needs cleaning'}
                            className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-orange-600"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Bottom action strip: QR Code + Preview Menu + Edit */}
                    <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-2.5 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setQrTarget(t)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50/90 px-2.5 py-1.5 text-xs font-bold text-orange-700 transition hover:border-orange-400 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-200"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        QR Code
                      </button>
                      <a
                        href={buildTableMenuUrl(t, r.name)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open Customer Menu for Table #${t.table_number}`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {rawTable && (
                        <button
                          type="button"
                          onClick={() => setEditing(rawTable)}
                          aria-label={`Edit table ${t.table_number}`}
                          title="Edit table"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-orange-300 hover:text-orange-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {qrTarget && <TableQrModal table={qrTarget} restaurantName={r.name} onClose={() => setQrTarget(null)} />}

      {editing && q.data && (
        <TableModal
          table={editing === 'new' ? null : editing}
          all={q.data.tables}
          restaurantId={r.id}
          defaultFloor={floor || 'Ground'}
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
        title={`Archive table ${archiveTarget?.table_number}?`}
        message="The table will be removed from the floor plan and POS. Past orders keep their table reference."
        onConfirm={async () => {
          if (archiveTarget) await setArchived(archiveTarget, true);
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function TableModal({
  table,
  all,
  restaurantId,
  defaultFloor,
  onClose,
  onSaved,
}: {
  table: RestaurantTable | null;
  all: RestaurantTable[];
  restaurantId: string;
  defaultFloor: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const active = all.filter((t) => !t.archived_at);
  const nextNo = Math.max(0, ...active.map((t) => t.table_number)) + 1;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TableForm>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      table_number: table?.table_number ?? nextNo,
      name: table?.name ?? '',
      capacity: table?.capacity ?? 4,
      section: table?.section ?? 'Main',
      floor: table?.floor ?? defaultFloor,
      shape: table?.shape ?? 'square',
      pos_x: table?.pos_x ?? ((nextNo - 1) * 2) % 12,
      pos_y: table?.pos_y ?? Math.floor(((nextNo - 1) * 2) / 12),
    },
  });
  const submit = async (raw: TableForm) => {
    const v = tableSchema.parse(raw);
    setServerError(null);
    if (active.some((t) => t.id !== table?.id && t.table_number === v.table_number)) {
      setError('table_number', { message: 'Table number already in use' });
      return;
    }
    const row = { ...v, name: nullIfEmpty(v.name) };
    try {
      if (table) unwrap(await supabase.from('restaurant_tables').update(row).eq('id', table.id).select('id').single());
      else
        unwrap(
          await supabase
            .from('restaurant_tables')
            .insert({ ...row, restaurant_id: restaurantId })
            .select('id')
            .single(),
        );
      toast.success(`Table ${v.table_number} saved.`);
      await onSaved();
    } catch (e) {
      const m = friendlyError(e);
      if (/table with this number/.test(m)) setError('table_number', { message: m });
      else setServerError(m);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={table ? `Edit table ${table.table_number}` : 'New table'}
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
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-2 gap-4" noValidate>
        <Input
          label="Table number"
          type="number"
          min="1"
          {...register('table_number')}
          error={errors.table_number?.message}
          required
        />
        <Input label="Name (optional)" {...register('name')} error={errors.name?.message} placeholder="e.g. Window" />
        <Input
          label="Seats"
          type="number"
          min="1"
          max="50"
          {...register('capacity')}
          error={errors.capacity?.message}
        />
        <Select label="Shape" {...register('shape')}>
          <option value="square">Square</option>
          <option value="round">Round</option>
          <option value="rect">Long table</option>
        </Select>
        <Input
          label="Section"
          {...register('section')}
          error={errors.section?.message}
          placeholder="Main, Terrace, VIP…"
        />
        <Input label="Floor" {...register('floor')} error={errors.floor?.message} placeholder="Ground, First…" />
        <Input
          label="Grid column (0–11)"
          type="number"
          min="0"
          max="11"
          {...register('pos_x')}
          error={errors.pos_x?.message}
        />
        <Input
          label="Grid row (0–11)"
          type="number"
          min="0"
          max="11"
          {...register('pos_y')}
          error={errors.pos_y?.message}
        />
        {serverError && (
          <p role="alert" className="col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
