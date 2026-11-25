import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageOff, Plus } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { fetchCategories, fetchProducts } from '@sombill/api-client/queries';
import { formatMoney } from '@sombill/shared-utils/format';
import { cn } from '@sombill/shared-utils/cn';
import type { Product } from '@sombill/shared-types/types';
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '@sombill/shared-ui/ui/Feedback';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useCart } from '@sombill/shared-hooks/cart';

export default function WaiterMenuPage() {
  const r = useRestaurant();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [catId, setCatId] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Product | null>(null);
  const q = useQuery(async () => {
    const [products, categories] = await Promise.all([fetchProducts(r.id), fetchCategories(r.id)]);
    return { products, categories };
  }, [r.id]);
  useRealtime(['products', 'categories'], r.id, () => void q.reload());

  const cats = (q.data?.categories ?? []).filter((c) => c.is_active && !c.archived_at);
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? 'Other';
  const products = useMemo(() => {
    const ids = new Set(cats.map((c) => c.id));
    const t = search.trim().toLowerCase();
    return (q.data?.products ?? [])
      .filter((p) => !p.archived_at && (!p.category_id || ids.has(p.category_id)))
      .filter((p) => !catId || p.category_id === catId)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.description?.toLowerCase().includes(t));
  }, [q.data, catId, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (p: Product) => {
    if (cart.existingOrderId === null && !cart.tableId)
      toast.info(`${p.name} added. Choose a table in New Order to send it.`);
    else toast.success(`${p.name} added to the order.`);
    cart.addProduct(p);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Service · Live Catalog"
        title="Menu"
        description="Live menu set by your manager. Prices and availability update automatically."
        actions={
          cart.itemCount > 0 ? (
            <Button onClick={() => navigate('/waiter/new-order')}>Go to order ({cart.itemCount})</Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search menu" className="md:w-80" />
        <div className="flex flex-wrap gap-2">
          {[{ id: '', name: 'All' }, ...cats].map((c) => (
            <button
              key={c.id || 'all'}
              type="button"
              onClick={() => setCatId(c.id)}
              aria-pressed={catId === c.id}
              className={cn(
                'h-10 rounded-full border px-4 text-sm font-semibold',
                catId === c.id
                  ? 'border-brand-navy bg-brand-navy text-white'
                  : 'border-slate-300 bg-white text-slate-700',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {q.error ? (
        <div className="card">
          <ErrorState message={q.error} onRetry={q.reload} />
        </div>
      ) : q.loading && !q.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !products.length ? (
        <div className="card">
          <EmptyState
            title="No products"
            message={search ? 'Nothing matches your search.' : 'Your manager has not published products yet.'}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Menu products">
          {products.map((p) => (
            <li key={p.id} className={cn('card flex gap-3 p-3', !p.is_available && 'opacity-60')}>
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100"
                onClick={() => setDetail(p)}
                aria-label={`Details for ${p.name}`}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <ImageOff className="h-6 w-6 text-slate-300" />
                )}
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <button type="button" className="text-left" onClick={() => setDetail(p)}>
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">{catName(p.category_id)}</p>
                  {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{p.description}</p>}
                </button>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="font-bold tabular-nums text-brand-navy">{formatMoney(p.price, r.currency)}</span>
                  {p.is_available ? (
                    <Button
                      size="sm"
                      variant="orange"
                      className="h-10 px-3"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => add(p)}
                      aria-label={`Add ${p.name} to order`}
                    >
                      Add
                    </Button>
                  ) : (
                    <Badge tone="red">Unavailable</Badge>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={detail.name}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              {detail.is_available && (
                <Button
                  variant="orange"
                  className=""
                  onClick={() => {
                    add(detail);
                    setDetail(null);
                  }}
                >
                  Add to order
                </Button>
              )}
            </>
          }
        >
          <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {detail.image_url ? (
              <img src={detail.image_url} alt={detail.name} className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Category</dt>
            <dd>{catName(detail.category_id)}</dd>
            <dt className="text-slate-500">Price</dt>
            <dd className="font-semibold">{formatMoney(detail.price, r.currency)}</dd>
            <dt className="text-slate-500">Availability</dt>
            <dd>{detail.is_available ? 'Available' : 'Unavailable'}</dd>
            <dt className="text-slate-500">Station</dt>
            <dd className="capitalize">{detail.preparation_station}</dd>
          </dl>
          {detail.description && <p className="mt-3 text-sm text-slate-600">{detail.description}</p>}
        </Modal>
      )}
    </div>
  );
}
