import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@sombill/shared-types/database.types';
import { createDevPreviewSupabase } from './devPreviewSupabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isPlaceholder = (v?: string) => !v || /YOUR-PROJECT|YOUR-ANON-KEY/i.test(v);
export const supabaseConfigured = Boolean(!isPlaceholder(url) && !isPlaceholder(anonKey));

const useDevPreview = Boolean(import.meta.env?.DEV) && import.meta.env?.MODE !== 'test' && !supabaseConfigured;

// The anon key is public by design; authorization is enforced by RLS.
export const supabase: SupabaseClient<Database> = useDevPreview
  ? (createDevPreviewSupabase() as unknown as SupabaseClient<Database>)
  : createClient<Database>(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Array<[RegExp, string]> = [
  [/uq_products_sku/, 'Another product already uses this SKU.'],
  [/uq_products_barcode/, 'Another product already uses this barcode.'],
  [/uq_categories_name/, 'A category with this name already exists.'],
  [/uq_tables_number/, 'A table with this number already exists.'],
  [/uq_customers_phone/, 'A customer with this phone number already exists.'],
  [/uq_suppliers_name/, 'A supplier with this name already exists.'],
  [/uq_inventory_sku/, 'Another inventory item already uses this SKU.'],
  [/purchase_order_items_purchase_order_id_inventory_item_id_key/, 'This item is already on the purchase order.'],
  [/row-level security|permission denied/i, 'You do not have permission to perform this action.'],
  [/JWT expired/i, 'Your session expired. Please sign in again.'],
  [/Failed to fetch|NetworkError/i, 'Network error. Check your connection and try again.'],
];

export function friendlyError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
  for (const [re, text] of FRIENDLY) if (re.test(msg)) return text;
  return msg || 'Something went wrong.';
}

/** Unwraps a Supabase response, throwing a readable AppError on failure. */
export function unwrap<T>(res: { data: unknown; error: PostgrestError | null }): T {
  if (res.error) throw new AppError(friendlyError(res.error), res.error.code);
  return res.data as T;
}

/** Fetches every row of a query in pages (PostgREST caps responses at 1000 rows). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: readonly unknown[] | null; error: PostgrestError | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = unwrap<T[] | null>(await build(from, from + pageSize - 1)) ?? [];
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}
