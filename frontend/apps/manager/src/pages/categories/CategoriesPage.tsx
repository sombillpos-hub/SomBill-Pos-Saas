import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, ArchiveRestore, ImageOff, Pencil, Plus } from 'lucide-react';
import { useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useRealtime } from '@sombill/shared-hooks/useRealtime';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { categorySchema, nullIfEmpty, type CategoryForm } from '@sombill/shared-types/schemas';
import { fetchCategories, fetchProducts } from '@sombill/api-client/queries';
import type { Category } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Checkbox, Input, Textarea } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ImageUpload } from '@sombill/manager/components/ImageUpload';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';

export default function CategoriesPage() {
  const r = useRestaurant();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);

  const q = useQuery(async () => {
    const [categories, products] = await Promise.all([fetchCategories(r.id), fetchProducts(r.id)]);
    const counts = new Map<string, { total: number; active: number }>();
    for (const p of products) {
      if (!p.category_id || p.archived_at) continue;
      const c = counts.get(p.category_id) ?? { total: 0, active: 0 };
      c.total += 1;
      if (p.is_available) c.active += 1;
      counts.set(p.category_id, c);
    }
    return { categories, counts };
  }, [r.id]);
  useRealtime(['categories', 'products'], r.id, () => void q.reload());

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data?.categories ?? [])
      .filter((c) => (showArchived ? !!c.archived_at : !c.archived_at))
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term));
  }, [q.data, search, showArchived]);

  const setArchived = async (c: Category, archived: boolean) => {
    unwrap(
      await supabase
        .from('categories')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', c.id)
        .select('id')
        .single(),
    );
    toast.success(`${c.name} ${archived ? 'archived' : 'restored'}.`);
    setArchiveTarget(null);
    await q.reload();
  };
  const toggleActive = async (c: Category) => {
    try {
      unwrap(
        await supabase.from('categories').update({ is_active: !c.is_active }).eq('id', c.id).select('id').single(),
      );
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const columns: Column<Category>[] = [
    { key: 'order', header: '#', cell: (c) => <span className="tabular-nums text-slate-500">{c.display_order}</span> },
    {
      key: 'name',
      header: 'Category',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            {c.image_url ? (
              <img src={c.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ImageOff className="h-4 w-4 text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{c.name}</p>
            {c.description && <p className="max-w-md truncate text-xs text-slate-500">{c.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      cell: (c) => {
        const n = q.data?.counts.get(c.id);
        return n ? `${n.active} / ${n.total}` : '0';
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) =>
        c.archived_at ? (
          <Badge tone="gray">Archived</Badge>
        ) : (
          <button type="button" onClick={() => void toggleActive(c)} title="Toggle visibility on POS">
            <Badge tone={c.is_active ? 'green' : 'red'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
          </button>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
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

  const nextOrder = Math.max(0, ...(q.data?.categories ?? []).map((c) => c.display_order)) + 1;
  const archiveCount = archiveTarget ? (q.data?.counts.get(archiveTarget.id)?.total ?? 0) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Menu Structure"
        title="Categories"
        description="Organise the menu. Display order controls how categories appear on POS."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories" className="sm:w-80" />
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
          rowKey={(c) => c.id}
          loading={q.loading && !q.data}
          error={q.error}
          onRetry={q.reload}
          empty={
            <EmptyState
              title={showArchived ? 'No archived categories' : 'No categories yet'}
              message={showArchived ? undefined : 'Create categories like Breakfast, Mains or Drinks.'}
              action={
                !showArchived ? (
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                    New category
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>
      {editing && q.data && (
        <CategoryModal
          category={editing === 'new' ? null : editing}
          all={q.data.categories}
          restaurantId={r.id}
          nextOrder={nextOrder}
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
        message={
          archiveCount
            ? `${archiveCount} product(s) are in this category. They stay on the menu but will show as uncategorised on POS until moved.`
            : 'The category will be hidden from POS. You can restore it later.'
        }
        onConfirm={async () => {
          if (archiveTarget) await setArchived(archiveTarget, true);
        }}
        onClose={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function CategoryModal({
  category,
  all,
  restaurantId,
  nextOrder,
  onClose,
  onSaved,
}: {
  category: Category | null;
  all: Category[];
  restaurantId: string;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [image, setImage] = useState<string | null>(category?.image_url ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      display_order: category?.display_order ?? nextOrder,
      is_active: category?.is_active ?? true,
    },
  });
  const submit = async (raw: CategoryForm) => {
    const v = categorySchema.parse(raw);
    setServerError(null);
    if (
      all.some((c) => c.id !== category?.id && !c.archived_at && c.name.trim().toLowerCase() === v.name.toLowerCase())
    ) {
      setError('name', { message: 'A category with this name already exists' });
      return;
    }
    const row = {
      name: v.name,
      description: nullIfEmpty(v.description),
      display_order: v.display_order,
      is_active: v.is_active,
      image_url: image,
    };
    try {
      if (category) unwrap(await supabase.from('categories').update(row).eq('id', category.id).select('id').single());
      else
        unwrap(
          await supabase
            .from('categories')
            .insert({ ...row, restaurant_id: restaurantId })
            .select('id')
            .single(),
        );
      toast.success(`Category ${v.name} saved.`);
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
      title={category ? `Edit ${category.name}` : 'New category'}
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
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Name"
            {...register('name')}
            error={errors.name?.message}
            required
            wrapClassName="sm:col-span-2"
          />
          <Input
            label="Display order"
            type="number"
            min="0"
            step="1"
            {...register('display_order')}
            error={errors.display_order?.message}
          />
        </div>
        <Textarea label="Description" {...register('description')} error={errors.description?.message} />
        <ImageUpload
          value={image}
          onChange={setImage}
          restaurantId={restaurantId}
          bucket="menu-images"
          folder="categories"
          label="Category image"
        />
        <Checkbox label="Active" description="Inactive categories are hidden on POS" {...register('is_active')} />
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
