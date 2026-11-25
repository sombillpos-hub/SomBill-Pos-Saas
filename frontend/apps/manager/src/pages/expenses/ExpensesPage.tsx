import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Check, Download, Paperclip, Pencil, Plus, X } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { expenseSchema, nullIfEmpty, type ExpenseForm } from '@sombill/shared-types/schemas';
import { fetchExpensesInRange, fetchSuppliers } from '@sombill/api-client/queries';
import { presetRange, todayInZone, type DateRange } from '@sombill/shared-utils/dates';
import { expenseByCategory } from '@sombill/shared-utils/reports';
import { downloadCsv } from '@sombill/shared-utils/csv';
import { signedAttachmentUrl, uploadFile } from '@sombill/api-client/storage';
import { formatDate, formatMoney, PAYMENT_METHOD_LABEL } from '@sombill/shared-utils/format';
import type { Expense, ExpenseStatus, PaymentMethod, Supplier } from '@sombill/shared-types/types';
import { Card, PageHeader, EmptyState, StatCard } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column } from '@sombill/shared-ui/ui/DataTable';
import { DateRangeFilter, SearchInput } from '@sombill/shared-ui/ui/Filters';
import { ShareBars } from '@sombill/manager/components/BarChart';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { ExpenseStatusBadge } from '@sombill/shared-ui/ui/StatusBadges';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';

const PAGE = 20;
const DEFAULT_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Maintenance',
  'Transport',
  'Marketing',
  'Supplies',
  'Licences & fees',
  'Other',
];

export default function ExpensesPage() {
  const r = useRestaurant();
  const toast = useToast();
  const staff = useStaffDirectory(r.id);
  const money = (n: number) => formatMoney(n, r.currency);
  const [range, setRange] = useState<DateRange>(() => presetRange('thisMonth', r.timezone));
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState<'' | ExpenseStatus>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [review, setReview] = useState<{ e: Expense; approve: boolean } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Expense | null>(null);

  const q = useQuery(async () => {
    const [expenses, suppliers] = await Promise.all([
      fetchExpensesInRange(r.id, range.from, range.to),
      fetchSuppliers(r.id),
    ]);
    return { expenses, suppliers };
  }, [r.id, range.from, range.to]);

  const categories = useMemo(
    () => [...new Set([...DEFAULT_CATEGORIES, ...(q.data?.expenses ?? []).map((e) => e.category)])].sort(),
    [q.data],
  );
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (q.data?.expenses ?? [])
      .filter((e) => (!cat || e.category === cat) && (!status || e.status === status))
      .filter((e) => !t || [e.description, e.reference_number, e.category].some((v) => v?.toLowerCase().includes(t)));
  }, [q.data, search, cat, status]);
  const approvedTotal = rows.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0);
  const pendingTotal = rows.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const byCat = expenseByCategory(rows);

  const openAttachment = async (path: string) => {
    try {
      window.open(await signedAttachmentUrl(path), '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const doReview = async (reason: string) => {
    if (!review) return;
    const { error } = await supabase.rpc('review_expense', {
      p_expense: review.e.id,
      p_approve: review.approve,
      p_reason: reason || null,
    });
    if (error) throw new Error(friendlyError(error));
    toast.success(review.approve ? 'Expense approved.' : 'Expense rejected.');
    setReview(null);
    await q.reload();
  };

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (e) => <span className="whitespace-nowrap">{formatDate(e.expense_date)}</span>,
    },
    {
      key: 'desc',
      header: 'Description',
      cell: (e) => (
        <div className="max-w-xs">
          <p className="truncate font-medium">{e.description}</p>
          <p className="text-xs text-slate-500">
            {e.category}
            {e.reference_number ? ` · Ref ${e.reference_number}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'method', header: 'Paid by', cell: (e) => PAYMENT_METHOD_LABEL[e.payment_method] },
    {
      key: 'status',
      header: 'Status',
      cell: (e) => (
        <div>
          <ExpenseStatusBadge s={e.status} />
          {e.status === 'rejected' && e.rejection_reason && (
            <p className="mt-0.5 max-w-[10rem] truncate text-xs text-slate-500" title={e.rejection_reason}>
              {e.rejection_reason}
            </p>
          )}
        </div>
      ),
    },
    { key: 'by', header: 'Recorded by', cell: (e) => staff.nameOf(e.created_by) },
    { key: 'amount', header: 'Amount', align: 'right', cell: (e) => <b>{money(e.amount)}</b> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (e) => (
        <div className="flex justify-end gap-1">
          {e.attachment_path && (
            <IconBtn label="View attachment" onClick={() => void openAttachment(e.attachment_path!)}>
              <Paperclip className="h-4 w-4" />
            </IconBtn>
          )}
          {e.status === 'pending' && (
            <IconBtn label="Approve" onClick={() => setReview({ e, approve: true })}>
              <Check className="h-4 w-4 text-emerald-600" />
            </IconBtn>
          )}
          {e.status === 'pending' && (
            <IconBtn label="Reject" onClick={() => setReview({ e, approve: false })}>
              <X className="h-4 w-4 text-brand-red" />
            </IconBtn>
          )}
          {e.status !== 'rejected' && (
            <IconBtn label="Edit" onClick={() => setEditing(e)}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
          )}
          <IconBtn label="Archive" onClick={() => setArchiveTarget(e)}>
            <Archive className="h-4 w-4" />
          </IconBtn>
        </div>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `expenses_${range.from}_${range.to}`,
      [
        'Date',
        'Category',
        'Description',
        'Amount',
        'Payment method',
        'Reference',
        'Status',
        'Recorded by',
        'Approved by',
      ],
      rows.map((e) => [
        e.expense_date,
        e.category,
        e.description,
        e.amount,
        PAYMENT_METHOD_LABEL[e.payment_method],
        e.reference_number,
        e.status,
        staff.nameOf(e.created_by),
        staff.nameOf(e.approved_by),
      ]),
    );

  return (
    <div>
      <PageHeader
        eyebrow="Finance & Insights · Operating Costs"
        title="Expenses"
        description="Operating costs, tracked separately from sales."
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
              New expense
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          loading={q.loading && !q.data}
          tone="red"
          label="Approved expenses"
          value={money(approvedTotal)}
          sub={`${rows.filter((e) => e.status === 'approved').length} records in view`}
        />
        <StatCard
          loading={q.loading && !q.data}
          tone="orange"
          label="Awaiting approval"
          value={money(pendingTotal)}
          sub={r.settings.expenses.approval_required ? 'Approval required (Settings)' : 'Approval not required'}
        />
        <Card title="By category" bodyClassName="p-4">
          <ShareBars format={money} rows={byCat.slice(0, 4).map((c) => ({ label: c.category, value: c.amount }))} />
        </Card>
      </div>
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search description or reference"
            className="xl:w-72"
          />
          <select
            className="input xl:w-44"
            aria-label="Category"
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input xl:w-40"
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ExpenseStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="xl:ml-auto">
            <DateRangeFilter
              value={range}
              onChange={(v) => {
                setRange(v);
                setPage(1);
              }}
              timeZone={r.timezone}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows.slice((page - 1) * PAGE, page * PAGE)}
          rowKey={(e) => e.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          empty={
            <EmptyState
              title="No expenses in this period"
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                  New expense
                </Button>
              }
            />
          }
        />
        <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
      </Card>
      {editing && q.data && (
        <ExpenseModal
          expense={editing === 'new' ? null : editing}
          categories={categories}
          suppliers={q.data.suppliers}
          restaurantId={r.id}
          currency={r.currency}
          today={todayInZone(r.timezone)}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await q.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!review}
        danger={review?.approve === false}
        requireReason={review?.approve === false}
        title={review?.approve ? 'Approve expense?' : 'Reject expense?'}
        message={review ? `${review.e.description} — ${money(review.e.amount)}` : ''}
        confirmLabel={review?.approve ? 'Approve' : 'Reject'}
        onConfirm={doReview}
        onClose={() => setReview(null)}
      />
      <ConfirmDialog
        open={!!archiveTarget}
        danger
        confirmLabel="Archive"
        title="Archive this expense?"
        message="Archived expenses are excluded from totals and reports but remain in the audit history."
        onConfirm={async () => {
          if (!archiveTarget) return;
          unwrap(
            await supabase
              .from('expenses')
              .update({ archived_at: new Date().toISOString() })
              .eq('id', archiveTarget.id)
              .select('id')
              .single(),
          );
          toast.success('Expense archived.');
          setArchiveTarget(null);
          await q.reload();
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function ExpenseModal({
  expense,
  categories,
  suppliers,
  restaurantId,
  currency,
  today,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  categories: string[];
  suppliers: Supplier[];
  restaurantId: string;
  currency: string;
  today: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: expense?.category ?? '',
      description: expense?.description ?? '',
      amount: expense?.amount ?? ('' as unknown as number),
      payment_method: expense?.payment_method ?? 'cash',
      expense_date: expense?.expense_date ?? today,
      reference_number: expense?.reference_number ?? '',
      supplier_id: expense?.supplier_id ?? '',
    },
  });
  const submit = async (raw: ExpenseForm) => {
    const v = expenseSchema.parse(raw);
    setServerError(null);
    if (v.expense_date > today) {
      setServerError('Expense date cannot be in the future.');
      return;
    }
    try {
      const attachment_path = file
        ? await uploadFile('expense-attachments', restaurantId, 'expenses', file)
        : (expense?.attachment_path ?? null);
      const row = {
        category: v.category,
        description: v.description,
        amount: v.amount,
        payment_method: v.payment_method,
        expense_date: v.expense_date,
        reference_number: nullIfEmpty(v.reference_number),
        supplier_id: v.supplier_id || null,
        attachment_path,
      };
      if (expense) unwrap(await supabase.from('expenses').update(row).eq('id', expense.id).select('id').single());
      else
        unwrap(
          await supabase
            .from('expenses')
            .insert({ ...row, restaurant_id: restaurantId })
            .select('id')
            .single(),
        );
      toast.success('Expense saved.');
      await onSaved();
    } catch (e) {
      setServerError(friendlyError(e));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? 'Edit expense' : 'New expense'}
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
        <div>
          <Input
            label="Category"
            list="expense-categories"
            {...register('category')}
            error={errors.category?.message}
            required
          />
          <datalist id="expense-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Input
          label={`Amount (${currency})`}
          type="number"
          step="0.01"
          min="0.01"
          {...register('amount')}
          error={errors.amount?.message}
          required
        />
        <Input
          label="Description"
          {...register('description')}
          error={errors.description?.message}
          required
          wrapClassName="sm:col-span-2"
        />
        <Input
          label="Date"
          type="date"
          max={today}
          {...register('expense_date')}
          error={errors.expense_date?.message}
        />
        <Select label="Payment method" {...register('payment_method')}>
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </Select>
        <Input
          label="Reference number"
          {...register('reference_number')}
          error={errors.reference_number?.message}
          placeholder="Invoice / receipt no."
        />
        <Select label="Supplier (optional)" {...register('supplier_id')}>
          <option value="">None</option>
          {suppliers
            .filter((s) => !s.archived_at)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
        <div className="sm:col-span-2">
          <span className="label">Attachment</span>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Paperclip className="h-4 w-4" />}
              onClick={() => fileRef.current?.click()}
            >
              {file || expense?.attachment_path ? 'Replace file' : 'Attach receipt'}
            </Button>
            <span className="truncate text-sm text-slate-500">
              {file?.name ?? (expense?.attachment_path ? 'Existing attachment' : 'PDF or image, max 5 MB')}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            aria-label="Attachment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
