import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import type { Payment, Restaurant } from '@sombill/shared-types/types';
import { fetchOrderBundle, profileName } from '../services/data';
import type { DocKind, ReceiptData } from '../features/receiptModel';

type ReceiptRestaurant = ReceiptData['restaurant'];

/** Fetches everything needed to render or ESC/POS-encode a receipt, bill, or transaction record. */
export async function fetchReceiptData(
  kind: DocKind,
  id: string,
  restaurant?: ReceiptRestaurant,
  fallbackCashierName = '—',
  receiptNumberOverride?: number | null,
): Promise<ReceiptData | null> {
  let orderId = id;
  let only: Payment | null = null;
  if (kind === 'transaction') {
    only = unwrap(await supabase.from('payments').select('*').eq('id', id).maybeSingle()) as Payment | null;
    if (!only) return null;
    orderId = only.order_id;
  }
  const b = await fetchOrderBundle(orderId);
  if (!b) return null;
  let rest: ReceiptRestaurant | undefined = restaurant;
  if (!rest) {
    const row = unwrap(
      await supabase
        .from('restaurants')
        .select('name,address,phone,currency,timezone,tax_label,receipt_header,receipt_footer')
        .eq('id', b.order.restaurant_id)
        .maybeSingle(),
    ) as Pick<
      Restaurant,
      'name' | 'address' | 'phone' | 'currency' | 'timezone' | 'tax_label' | 'receipt_header' | 'receipt_footer'
    > | null;
    if (!row) return null;
    rest = row;
  }
  const cashierUid = kind === 'transaction' ? only!.cashier_id : (b.receipt?.issued_by ?? b.order.cashier_id);
  const cashierName = cashierUid ? await profileName(cashierUid) : fallbackCashierName;
  return {
    kind,
    restaurant: rest,
    order: b.order,
    items: b.items,
    payments: only ? [only] : b.payments,
    receiptNumber:
      receiptNumberOverride !== undefined
        ? receiptNumberOverride
        : kind === 'receipt'
          ? (b.receipt?.receipt_number ?? null)
          : null,
    cashierName,
    tableNumber: b.table?.table_number ?? null,
    printedAt: new Date(),
    reprint: b.receipt?.print_count,
  };
}

/** Loads everything a receipt / bill / transaction record needs. `id` is an order id (receipt, bill) or payment id (transaction). */
export function useReceiptData(kind: DocKind, id: string) {
  const r = useRestaurant();
  const { profile } = useAuth();
  return useQuery<ReceiptData | null>(
    () => fetchReceiptData(kind, id, r, profile?.full_name || '—'),
    [kind, id, r.id],
  );
}
