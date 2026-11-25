import { fetchAll, supabase, unwrap } from './supabase';
import type {
  AuditLog,
  Category,
  Expense,
  InventoryItem,
  Order,
  OrderItem,
  Payment,
  Product,
  RestaurantTable,
  Supplier,
  TableStatusRow,
} from '@sombill/shared-types/types';

export const fetchOrdersInRange = (rid: string, fromIso: string, toIso: string) =>
  fetchAll<Order>((a, b) =>
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', rid)
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: false })
      .range(a, b),
  );

export const fetchPaymentsInRange = (rid: string, fromIso: string, toIso: string) =>
  fetchAll<Payment>((a, b) =>
    supabase
      .from('payments')
      .select('*')
      .eq('restaurant_id', rid)
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: false })
      .range(a, b),
  );

/** Non-voided items whose order was created in range (joined via inner filter). */
export const fetchItemsForOrdersInRange = (rid: string, fromIso: string, toIso: string) =>
  fetchAll<OrderItem & { orders: { status: string; created_at: string } }>((a, b) =>
    supabase
      .from('order_items')
      .select('*, orders!inner(status, created_at)')
      .eq('restaurant_id', rid)
      .eq('is_voided', false)
      .gte('orders.created_at', fromIso)
      .lt('orders.created_at', toIso)
      .neq('orders.status', 'cancelled')
      .order('id')
      .range(a, b),
  );

export const fetchExpensesInRange = (rid: string, fromYmd: string, toYmd: string) =>
  fetchAll<Expense>((a, b) =>
    supabase
      .from('expenses')
      .select('*')
      .eq('restaurant_id', rid)
      .gte('expense_date', fromYmd)
      .lte('expense_date', toYmd)
      .is('archived_at', null)
      .order('expense_date', { ascending: false })
      .range(a, b),
  );

export const fetchProducts = (rid: string) =>
  fetchAll<Product>((a, b) => supabase.from('products').select('*').eq('restaurant_id', rid).order('name').range(a, b));
export const fetchCategories = async (rid: string) =>
  unwrap(
    await supabase.from('categories').select('*').eq('restaurant_id', rid).order('display_order').order('name'),
  ) as Category[];
export const fetchInventory = (rid: string) =>
  fetchAll<InventoryItem>((a, b) =>
    supabase.from('inventory_items').select('*').eq('restaurant_id', rid).order('name').range(a, b),
  );
export const fetchSuppliers = async (rid: string) =>
  unwrap(await supabase.from('suppliers').select('*').eq('restaurant_id', rid).order('name')) as Supplier[];
export const fetchTables = async (rid: string) =>
  unwrap(
    await supabase.from('restaurant_tables').select('*').eq('restaurant_id', rid).order('table_number'),
  ) as RestaurantTable[];
export const fetchTableStatus = async (rid: string) =>
  unwrap(
    await supabase
      .from('table_status_v')
      .select('*')
      .eq('restaurant_id', rid)
      .is('archived_at', null)
      .order('table_number'),
  ) as TableStatusRow[];
export const fetchAudit = async (
  rid: string,
  opts: { entityType?: string; entityIds?: string[]; limit?: number } = {},
) => {
  let q = supabase.from('audit_logs').select('*').eq('restaurant_id', rid);
  if (opts.entityType) q = q.eq('entity_type', opts.entityType);
  if (opts.entityIds?.length) q = q.in('entity_id', opts.entityIds);
  return unwrap(await q.order('created_at', { ascending: false }).limit(opts.limit ?? 50)) as AuditLog[];
};
