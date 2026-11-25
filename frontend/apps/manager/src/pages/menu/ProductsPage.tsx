import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Eye, History, ImageOff, Pencil, Plus, ChefHat } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { useStaffDirectory } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { fetchAudit, fetchCategories, fetchInventory, fetchProducts } from '@sombill/api-client/queries';
import { formatDateTime, formatMoney } from '@sombill/shared-utils/format';
import type { Product } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, Pagination, type Column, type SortState } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { ProductFormModal } from '../../components/ProductFormModal';
import { RecipeModal } from '../../components/RecipeModal';

const PAGE = 20;

export default function ProductsPage() {
  const r = useRestaurant();
  const toast = useToast();
  const money = (n: number | null) => (n === null ? '—' : formatMoney(n, r.currency));
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [view, setView] = useState<'active' | 'unavailable' | 'archived'>('active');
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  const q = useQuery(async () => {
    const [products, categories, inventory] = await Promise.all([
      fetchProducts(r.id),
      fetchCategories(r.id),
      fetchInventory(r.id),
    ]);
    return { products, categories, inventory };
  }, [r.id]);
  useRealtime(['products', 'categories'], r.id, () => void q.reload());

  const catName = (id: string | null) => q.data?.categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = (q.data?.products ?? []).filter((p) =>
      view === 'archived' ? !!p.archived_at : !p.archived_at && (view === 'active' ? p.is_available : !p.is_available),
    );
    if (categoryId) list = list.filter((p) => p.category_id === categoryId);
    if (term)
      list = list.filter((p) => [p.name, p.sku, p.barcode, p.description].some((v) => v?.toLowerCase().includes(term)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av =
        sort.key === 'price'
          ? a.price
          : sort.key === 'category'
            ? catName(a.category_id)
            : sort.key === 'updated_at'
              ? a.updated_at
              : a.name.toLowerCase();
      const bv =
        sort.key === 'price'
          ? b.price
          : sort.key === 'category'
            ? catName(b.category_id)
            : sort.key === 'updated_at'
              ? b.updated_at
              : b.name.toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [q.data, search, categoryId, view, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const setArchived = async (p: Product, archived: boolean) => {
    unwrap(
      await supabase
        .from('products')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', p.id)
        .select('id')
        .single(),
    );
    toast.success(`${p.name} ${archived ? 'archived — removed from POS' : 'restored'}.`);
    setArchiveTarget(null);
    await q.reload();
  };
  const toggleAvailable = async (p: Product) => {
    try {
      unwrap(
        await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id).select('id').single(),
      );
      toast.success(`${p.name} is now ${p.is_available ? 'unavailable' : 'available'} on POS.`);
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ImageOff className="h-4 w-4 text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="truncate text-xs text-slate-500">
              {p.sku ?? 'No SKU'}
              {p.barcode ? ` · ${p.barcode}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: true, cell: (p) => catName(p.category_id) },
    { key: 'price', header: 'Price', sortable: true, align: 'right', cell: (p) => money(p.price) },
    { key: 'cost', header: 'Cost', align: 'right', cell: (p) => money(p.cost_price) },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      cell: (p) =>
        p.cost_price !== null && p.price > 0 ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%` : '—',
    },
    {
      key: 'flags',
      header: 'Status',
      cell: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.archived_at ? (
            <Badge tone="gray">Archived</Badge>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void toggleAvailable(p);
              }}
              title="Toggle availability"
            >
              <Badge tone={p.is_available ? 'green' : 'red'}>{p.is_available ? 'Available' : 'Unavailable'}</Badge>
            </button>
          )}
          {p.track_stock && <Badge tone="blue">Stock</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconBtn label="Preview" onClick={() => setPreview(p)}>
            <Eye className="h-4 w-4" />
          </IconBtn>
          {!p.archived_at && (
            <IconBtn label="Edit" onClick={() => setEditing(p)}>
              <Pencil className="h-4 w-4" />
            </IconBtn>
          )}
          {!p.archived_at && (
            <IconBtn label="Recipe" onClick={() => setRecipeFor(p)}>
              <ChefHat className="h-4 w-4" />
            </IconBtn>
          )}
          <IconBtn label="Price history" onClick={() => setHistoryFor(p)}>
            <History className="h-4 w-4" />
          </IconBtn>
          {p.archived_at ? (
            <IconBtn
              label="Restore"
              onClick={() => void setArchived(p, false).catch((e) => toast.error(friendlyError(e)))}
            >
              <ArchiveRestore className="h-4 w-4" />
            </IconBtn>
          ) : (
            <IconBtn label="Archive" onClick={() => setArchiveTarget(p)}>
              <Archive className="h-4 w-4" />
            </IconBtn>
          )}
        </div>
      ),
    },
  ];

  const counts = {
    active: q.data?.products.filter((p) => !p.archived_at && p.is_available).length ?? 0,
    unavailable: q.data?.products.filter((p) => !p.archived_at && !p.is_available).length ?? 0,
    archived: q.data?.products.filter((p) => p.archived_at).length ?? 0,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Menu Catalog"
        title="Menu Management"
        description="Products here appear instantly on Waiter and Cashier POS when available."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New product
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, SKU or barcode"
            className="lg:w-80"
          />
          <select
            className="input lg:w-56"
            aria-label="Category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {(q.data?.categories ?? [])
              .filter((c) => !c.archived_at)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <div className="flex rounded-lg border border-slate-200 p-0.5 lg:ml-auto">
            {(['active', 'unavailable', 'archived'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setView(v);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${view === v ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {v === 'active' ? 'Available' : v} ({counts[v]})
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(p) => p.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          sort={sort}
          onSort={setSort}
          onRowClick={(p) => setPreview(p)}
          empty={
            <EmptyState
              title={search || categoryId ? 'No products match' : 'No products yet'}
              message={
                search || categoryId
                  ? 'Try another search or category.'
                  : 'Create your first product to start selling on POS.'
              }
              action={
                !search && !categoryId && view === 'active' ? (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                    New product
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
      </Card>

      {editing && q.data && (
        <ProductFormModal
          product={editing === 'new' ? null : editing}
          categories={q.data.categories}
          inventory={q.data.inventory}
          existing={q.data.products}
          restaurantId={r.id}
          currency={r.currency}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await q.reload();
          }}
        />
      )}
      {recipeFor && q.data && (
        <RecipeModal
          product={recipeFor}
          inventory={q.data.inventory}
          currency={r.currency}
          onClose={() => setRecipeFor(null)}
          onSaved={q.reload}
        />
      )}
      {preview && (
        <PreviewModal
          product={preview}
          category={catName(preview.category_id)}
          currency={r.currency}
          onClose={() => setPreview(null)}
          onEdit={
            !preview.archived_at
              ? () => {
                  setEditing(preview);
                  setPreview(null);
                }
              : undefined
          }
        />
      )}
      {historyFor && <PriceHistoryModal product={historyFor} onClose={() => setHistoryFor(null)} />}
      <ConfirmDialog
        open={!!archiveTarget}
        title={`Archive ${archiveTarget?.name}?`}
        confirmLabel="Archive"
        danger
        message="Archived products disappear from POS but stay in historical orders and reports. You can restore them any time."
        onConfirm={async () => {
          if (archiveTarget) await setArchived(archiveTarget, true);
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

export function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-navy"
    >
      {children}
    </button>
  );
}

function PreviewModal({
  product: p,
  category,
  currency,
  onClose,
  onEdit,
}: {
  product: Product;
  category: string;
  currency: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={p.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onEdit && (
            <Button onClick={onEdit} icon={<Pencil className="h-4 w-4" />}>
              Edit
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:w-40">
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-8 w-8 text-slate-300" />
          )}
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Category</dt>
          <dd>{category}</dd>
          <dt className="text-slate-500">Price</dt>
          <dd className="font-semibold">{formatMoney(p.price, currency)}</dd>
          <dt className="text-slate-500">Cost</dt>
          <dd>{p.cost_price === null ? '—' : formatMoney(p.cost_price, currency)}</dd>
          <dt className="text-slate-500">SKU</dt>
          <dd>{p.sku ?? '—'}</dd>
          <dt className="text-slate-500">Barcode</dt>
          <dd>{p.barcode ?? '—'}</dd>
          <dt className="text-slate-500">Tax</dt>
          <dd className="capitalize">{p.tax_category}</dd>
          <dt className="text-slate-500">Station</dt>
          <dd className="capitalize">{p.preparation_station}</dd>
          <dt className="text-slate-500">Stock tracking</dt>
          <dd>{p.track_stock ? 'Yes' : 'No'}</dd>
        </dl>
      </div>
      {p.description && <p className="mt-4 text-sm text-slate-600">{p.description}</p>}
    </Modal>
  );
}

function PriceHistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const r = useRestaurant();
  const staff = useStaffDirectory(r.id);
  const q = useQuery(
    async () =>
      (await fetchAudit(r.id, { entityType: 'products', entityIds: [product.id], limit: 200 })).filter(
        (a) => a.action === 'price_change' || a.action === 'create',
      ),
    [product.id],
  );
  const money = (v: unknown) => (v === null || v === undefined ? '—' : formatMoney(Number(v), r.currency));
  return (
    <Modal open onClose={onClose} title={`Price history · ${product.name}`} size="lg">
      {q.loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !q.data?.length ? (
        <EmptyState title="No price changes recorded" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">By</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.map((a) => (
                <tr key={a.id}>
                  <td className="td whitespace-nowrap">{formatDateTime(a.created_at, r.timezone)}</td>
                  <td className="td">{staff.nameOf(a.actor_id)}</td>
                  <td className="td text-right">
                    {a.action === 'create'
                      ? money(a.new_data?.price)
                      : a.new_data && 'price' in a.new_data
                        ? `${money(a.old_data?.price)} → ${money(a.new_data.price)}`
                        : '—'}
                  </td>
                  <td className="td text-right">
                    {a.action === 'create'
                      ? money(a.new_data?.cost_price)
                      : a.new_data && 'cost_price' in a.new_data
                        ? `${money(a.old_data?.cost_price)} → ${money(a.new_data.cost_price)}`
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
