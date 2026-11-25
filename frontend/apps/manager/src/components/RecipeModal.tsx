import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { formatMoney } from '@sombill/shared-utils/format';
import type { InventoryItem, Product, RecipeItem } from '@sombill/shared-types/types';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { Button } from '@sombill/shared-ui/ui/Button';
import { useToast } from '@sombill/shared-ui/ui/Toast';

interface Line {
  key: string;
  inventory_item_id: string;
  quantity: string;
}

/** Links ingredients to a menu product; stock is deducted per unit sold when the order completes. */
export function RecipeModal({
  product,
  inventory,
  currency,
  onClose,
  onSaved,
}: {
  product: Product;
  inventory: InventoryItem[];
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const q = useQuery(
    async () =>
      unwrap(await supabase.from('product_recipe_items').select('*').eq('product_id', product.id)) as RecipeItem[],
    [product.id],
  );

  useEffect(() => {
    if (q.data)
      setLines(
        q.data.map((r) => ({ key: r.id, inventory_item_id: r.inventory_item_id, quantity: String(r.quantity) })),
      );
  }, [q.data]);

  const active = inventory.filter((i) => !i.archived_at);
  const itemOf = (id: string) => inventory.find((i) => i.id === id);
  const cost = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (itemOf(l.inventory_item_id)?.unit_cost ?? 0), 0);

  const save = async () => {
    setError(null);
    const clean = lines.filter((l) => l.inventory_item_id);
    const ids = new Set<string>();
    for (const l of clean) {
      const qn = Number(l.quantity);
      if (!Number.isFinite(qn) || qn <= 0) {
        setError('Every ingredient needs a quantity greater than zero.');
        return;
      }
      if (ids.has(l.inventory_item_id)) {
        setError('Each ingredient can only appear once.');
        return;
      }
      ids.add(l.inventory_item_id);
    }
    setSaving(true);
    try {
      const existing = q.data ?? [];
      const toDelete = existing.filter((e) => !clean.some((l) => l.inventory_item_id === e.inventory_item_id));
      if (toDelete.length)
        unwrap(
          await supabase
            .from('product_recipe_items')
            .delete()
            .in(
              'id',
              toDelete.map((d) => d.id),
            )
            .select('id'),
        );
      if (clean.length) {
        unwrap(
          await supabase
            .from('product_recipe_items')
            .upsert(
              clean.map((l) => ({
                restaurant_id: product.restaurant_id,
                product_id: product.id,
                inventory_item_id: l.inventory_item_id,
                quantity: Number(l.quantity),
              })),
              { onConflict: 'product_id,inventory_item_id' },
            )
            .select('id'),
        );
      }
      if (clean.length && !product.track_stock) {
        unwrap(
          await supabase.from('products').update({ track_stock: true }).eq('id', product.id).select('id').single(),
        );
      }
      toast.success(`Recipe for ${product.name} saved.`);
      await onSaved();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Recipe · ${product.name}`}
      description="Ingredients consumed for one unit sold."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save recipe
          </Button>
        </>
      }
    >
      {!active.length ? (
        <p className="text-sm text-slate-500">Add inventory items first (Inventory → New item) to build recipes.</p>
      ) : (
        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div key={l.key} className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="label">Ingredient</span>
                <select
                  className="input"
                  value={l.inventory_item_id}
                  onChange={(e) =>
                    setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, inventory_item_id: e.target.value } : x)))
                  }
                >
                  <option value="">Choose…</option>
                  {active.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-32">
                <span className="label">Qty {itemOf(l.inventory_item_id)?.unit ?? ''}</span>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  min="0"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                  }
                />
              </label>
              <button
                type="button"
                aria-label="Remove ingredient"
                className="mb-1 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setLines((ls) => [...ls, { key: crypto.randomUUID(), inventory_item_id: '', quantity: '' }])}
          >
            Add ingredient
          </Button>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            Estimated ingredient cost per unit: <b>{formatMoney(cost, currency)}</b>
            {product.price > 0 && <> · food cost {((cost / product.price) * 100).toFixed(1)}% of price</>}
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
