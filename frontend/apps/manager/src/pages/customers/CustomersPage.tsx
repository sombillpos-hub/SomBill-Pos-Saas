import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArchiveRestore, Download, Pencil, Plus } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { fetchAll, supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { customerSchema, nullIfEmpty, type CustomerForm } from '@sombill/shared-types/schemas';
import { orderBalance } from '@sombill/shared-utils/reports';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { formatDate, formatMoney } from '@sombill/shared-utils/format';
import type { Customer, Order } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column, type SortState } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Textarea } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';

const PAGE = 20;
interface Row extends Customer {
  orders: number;
  spent: number;
  outstanding: number;
  last: string | null;
}

export default function CustomersPage() {
  const r = useRestaurant();
  const toast = useToast();
  const navigate = useNavigate();
  const money = (n: number) => formatMoney(n, r.currency);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'balance' | 'archived'>('active');
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  const q = useQuery(async () => {
    const [customers, orders] = await Promise.all([
      fetchAll<Customer>((a, b) =>
        supabase.from('customers').select('*').eq('restaurant_id', r.id).order('name').range(a, b),
      ),
      fetchAll<Pick<Order, 'customer_id' | 'status' | 'total' | 'amount_paid' | 'amount_refunded' | 'created_at'>>(
        (a, b) =>
          supabase
            .from('orders')
            .select('customer_id,status,total,amount_paid,amount_refunded,created_at')
            .eq('restaurant_id', r.id)
            .not('customer_id', 'is', null)
            .order('id')
            .range(a, b),
      ),
    ]);
    const agg = new Map<string, { orders: number; spent: number; outstanding: number; last: string | null }>();
    for (const o of orders) {
      if (!o.customer_id || o.status === 'cancelled') continue;
      const a = agg.get(o.customer_id) ?? { orders: 0, spent: 0, outstanding: 0, last: null };
      a.orders += 1;
      a.spent += Number(o.amount_paid) - Number(o.amount_refunded);
      a.outstanding += orderBalance(o);
      if (!a.last || o.created_at > a.last) a.last = o.created_at;
      agg.set(o.customer_id, a);
    }
    return customers.map((c) => ({
      ...c,
      ...(agg.get(c.id) ?? { orders: 0, spent: 0, outstanding: 0, last: null }),
    })) as Row[];
  }, [r.id]);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const dir = sort.dir === 'asc' ? 1 : -1;
    return (q.data ?? [])
      .filter((c) =>
        filter === 'archived' ? !!c.archived_at : !c.archived_at && (filter !== 'balance' || c.outstanding > 0),
      )
      .filter((c) => !t || [c.name, c.phone, c.email, c.address].some((v) => v?.toLowerCase().includes(t)))
      .sort((a, b) => {
        const k = sort.key as keyof Row;
        const av = a[k] ?? '';
        const bv = b[k] ?? '';
        return (typeof av === 'string' ? av.toLowerCase() : av) < (typeof bv === 'string' ? bv.toLowerCase() : bv)
          ? -dir
          : av === bv
            ? 0
            : dir;
      });
  }, [q.data, search, filter, sort]);

  const setArchived = async (c: Customer, archived: boolean) => {
    unwrap(
      await supabase
        .from('customers')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', c.id)
        .select('id')
        .single(),
    );
    toast.success(`${c.name} ${archived ? 'archived' : 'restored'}.`);
    setArchiveTarget(null);
    await q.reload();
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      cell: (c) => (
        <div>
          <p className="font-semibold">{c.name}</p>
          <p className="text-xs text-slate-500">
            {c.phone ?? ''}
            {c.email ? ` · ${c.email}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'orders', header: 'Orders', sortable: true, align: 'right', cell: (c) => c.orders },
    { key: 'spent', header: 'Total purchases', sortable: true, align: 'right', cell: (c) => money(c.spent) },
    {
      key: 'outstanding',
      header: 'Outstanding',
      sortable: true,
      align: 'right',
      cell: (c) => (c.outstanding > 0 ? <Badge tone="red">{money(c.outstanding)}</Badge> : money(0)),
    },
    { key: 'last', header: 'Last order', sortable: true, cell: (c) => formatDate(c.last, r.timezone) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!c.archived_at && (
            <IconBtn label="Edit" onClick={() => setEditing(c)}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
          )}
          {c.archived_at ? (
            <IconBtn
              label="Restore"
              onClick={() => void setArchived(c, false).catch((e) => toast.error(friendlyError(e)))}
            >
              <ArchiveRestore className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Archive" onClick={() => setArchiveTarget(c)}>
              <Archive className="h-4 w-4" />
            </IconBtn>
          )}
        </div>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      'customers',
      ['Name', 'Phone', 'Email', 'Address', 'Orders', 'Total purchases', 'Outstanding', 'Last order', 'Notes'],
      rows.map((c) => [
        c.name,
        c.phone,
        c.email,
        c.address,
        c.orders,
        c.spent.toFixed(2),
        c.outstanding.toFixed(2),
        formatDate(c.last, r.timezone),
        c.notes,
      ]),
    );

  return (
    <div>
      <PageHeader
        eyebrow="People · Guest CRM"
        title="Customers"
        description="Customer profiles, purchase history and unpaid balances."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={exportCsv}
              disabled={!rows.length}
            >
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              New customer
            </Button>
          </>
        }
      />
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, phone, email"
            className="sm:w-80"
          />
          <select
            className="input sm:ml-auto sm:w-52"
            aria-label="Filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
          >
            <option value="active">Active customers</option>
            <option value="balance">With outstanding balance</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <DataTable
          columns={columns}
          rows={rows.slice((page - 1) * PAGE, page * PAGE)}
          rowKey={(c) => c.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          sort={sort}
          onSort={setSort}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          empty={
            <EmptyState
              title="No customers found"
              action={
                filter === 'active' && !search ? (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                    New customer
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
      </Card>
      {editing && (
        <CustomerModal
          customer={editing === 'new' ? null : editing}
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
        message="The customer is hidden from POS lookups. Their order history is preserved."
        onConfirm={async () => {
          if (archiveTarget) await setArchived(archiveTarget, true);
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

export function CustomerModal({
  customer,
  restaurantId,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
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
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      address: customer?.address ?? '',
      notes: customer?.notes ?? '',
    },
  });
  const submit = async (raw: CustomerForm) => {
    const v = customerSchema.parse(raw);
    setServerError(null);
    const row = {
      name: v.name,
      phone: nullIfEmpty(v.phone),
      email: nullIfEmpty(v.email)?.toLowerCase() ?? null,
      address: nullIfEmpty(v.address),
      notes: nullIfEmpty(v.notes),
    };
    try {
      if (customer) unwrap(await supabase.from('customers').update(row).eq('id', customer.id).select('id').single());
      else
        unwrap(
          await supabase
            .from('customers')
            .insert({ ...row, restaurant_id: restaurantId })
            .select('id')
            .single(),
        );
      toast.success(`${v.name} saved.`);
      await onSaved();
    } catch (e) {
      const m = friendlyError(e);
      if (/phone/.test(m)) setError('phone', { message: m });
      else setServerError(m);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? `Edit ${customer.name}` : 'New customer'}
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
        <Input label="Name" {...register('name')} error={errors.name?.message} required wrapClassName="sm:col-span-2" />
        <Input
          label="Phone"
          type="tel"
          {...register('phone')}
          error={errors.phone?.message}
          placeholder="+252 63 4123456"
        />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Address" {...register('address')} error={errors.address?.message} wrapClassName="sm:col-span-2" />
        <Textarea
          label="Notes"
          {...register('notes')}
          error={errors.notes?.message}
          wrapClassName="sm:col-span-2"
          hint="Allergies, preferences, account terms…"
        />
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
