import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { nullIfEmpty, productSchema, type ProductForm } from '@sombill/shared-types/schemas';
import type { Category, InventoryItem, Product } from '@sombill/shared-types/types';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { ImageUpload } from '@sombill/manager/components/ImageUpload';
import { useToast } from '@sombill/shared-ui/ui/Toast';

interface Props {
  product: Product | null;
  categories: Category[];
  inventory: InventoryItem[];
  existing: Product[];
  restaurantId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ProductFormModal({
  product,
  categories,
  inventory,
  existing,
  restaurantId,
  currency,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const [image, setImage] = useState<string | null>(product?.image_url ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      category_id: product?.category_id ?? '',
      price: product?.price ?? 0,
      cost_price: product?.cost_price ?? '',
      tax_category: product?.tax_category ?? 'standard',
      is_available: product?.is_available ?? true,
      track_stock: product?.track_stock ?? false,
      inventory_item_id: product?.inventory_item_id ?? '',
      preparation_station: product?.preparation_station ?? 'kitchen',
    },
  });
  const trackStock = watch('track_stock');

  const submit = async (raw: ProductForm) => {
    setServerError(null);
    const v = productSchema.parse(raw);
    const sku = nullIfEmpty(v.sku);
    const barcode = nullIfEmpty(v.barcode);
    // Friendly pre-check; the unique index is the real guard.
    if (sku && existing.some((p) => p.id !== product?.id && p.sku?.toLowerCase() === sku.toLowerCase())) {
      setError('sku', { message: 'Another product already uses this SKU' });
      return;
    }
    if (barcode && existing.some((p) => p.id !== product?.id && p.barcode === barcode)) {
      setError('barcode', { message: 'Another product already uses this barcode' });
      return;
    }
    const row = {
      name: v.name,
      description: nullIfEmpty(v.description),
      sku,
      barcode,
      category_id: v.category_id || null,
      image_url: image,
      price: v.price,
      cost_price: v.cost_price === '' ? null : v.cost_price,
      tax_category: v.tax_category,
      is_available: v.is_available,
      track_stock: v.track_stock,
      inventory_item_id: v.track_stock && v.inventory_item_id ? v.inventory_item_id : null,
      preparation_station: v.preparation_station,
    };
    try {
      if (product) unwrap(await supabase.from('products').update(row).eq('id', product.id).select('id').single());
      else
        unwrap(
          await supabase
            .from('products')
            .insert({ ...row, restaurant_id: restaurantId })
            .select('id')
            .single(),
        );
      toast.success(product ? `${v.name} updated.` : `${v.name} created and published to POS.`);
      await onSaved();
    } catch (e) {
      const msg = friendlyError(e);
      if (/SKU/.test(msg)) setError('sku', { message: msg });
      else if (/barcode/.test(msg)) setError('barcode', { message: msg });
      else setServerError(msg);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={product ? `Edit ${product.name}` : 'New product'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={isSubmitting}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
        <Input
          label="Product name"
          {...register('name')}
          error={errors.name?.message}
          required
          wrapClassName="md:col-span-2"
        />
        <Select label="Category" {...register('category_id')}>
          <option value="">Uncategorised</option>
          {categories
            .filter((c) => !c.archived_at || c.id === product?.category_id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_active ? '' : ' (inactive)'}
              </option>
            ))}
        </Select>
        <Select label="Preparation station" {...register('preparation_station')}>
          <option value="kitchen">Kitchen</option>
          <option value="grill">Grill</option>
          <option value="bar">Bar / drinks</option>
          <option value="bakery">Bakery</option>
          <option value="none">None (ready to serve)</option>
        </Select>
        <Input
          label={`Selling price (${currency})`}
          type="number"
          step="0.01"
          min="0"
          {...register('price')}
          error={errors.price?.message}
          required
        />
        <Input
          label={`Cost price (${currency})`}
          type="number"
          step="0.01"
          min="0"
          {...register('cost_price')}
          error={errors.cost_price?.message}
          hint="Optional — used for profit estimates"
        />
        <Input label="SKU" {...register('sku')} error={errors.sku?.message} placeholder="e.g. MAIN-001" />
        <Input label="Barcode" {...register('barcode')} error={errors.barcode?.message} />
        <Select label="Tax category" {...register('tax_category')}>
          <option value="standard">Standard (taxed)</option>
          <option value="exempt">Exempt</option>
        </Select>
        <ImageUpload
          value={image}
          onChange={setImage}
          restaurantId={restaurantId}
          bucket="menu-images"
          folder="products"
          label="Product image"
        />
        <Textarea
          label="Description"
          {...register('description')}
          error={errors.description?.message}
          wrapClassName="md:col-span-2"
        />
        <Checkbox
          label="Available on POS"
          description="Waiters and cashiers can sell this product"
          {...register('is_available')}
        />
        <Checkbox
          label="Track stock"
          description="Deduct ingredients (recipe) or a linked stock item when sold"
          {...register('track_stock')}
        />
        {trackStock && (
          <Select
            label="Direct stock item (optional)"
            {...register('inventory_item_id')}
            wrapClassName="md:col-span-2"
            hint="For retail items like bottled drinks. If the product has a recipe, the recipe is used instead."
          >
            <option value="">— Use recipe —</option>
            {inventory
              .filter((i) => !i.archived_at)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
          </Select>
        )}
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
