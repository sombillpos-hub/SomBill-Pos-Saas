import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import type { Payment } from '@sombill/shared-types/types';
import { fetchOrderBundle, profileName } from '../services/data';
import type { DocKind, ReceiptData } from '../features/receiptModel';

/** Loads everything a receipt / bill / transaction record needs. `id` is an order id (receipt, bill) or payment id (transaction). */
export function useReceiptData(kind: DocKind, id: string) {
  const r = useRestaurant();
  const { profile } = useAuth();
  return useQuery<ReceiptData | null>(async () => {
    let orderId = id;
    let only: Payment | null = null;
    if (kind === 'transaction') {
      only = unwrap(await supabase.from('payments').select('*').eq('id', id).maybeSingle()) as Payment | null;
      if (!only) return null;
      orderId = only.order_id;
    }
    const b = await fetchOrderBundle(orderId);
    if (!b) return null;
    const cashierUid = kind === 'transaction' ? only!.cashier_id : (b.receipt?.issued_by ?? b.order.cashier_id);
    const cashierName = cashierUid ? await profileName(cashierUid) : profile?.full_name || '—';
    return {
      kind,
      restaurant: r,
      order: b.order,
      items: b.items,
      payments: only ? [only] : b.payments,
      receiptNumber: kind === 'receipt' ? (b.receipt?.receipt_number ?? null) : null,
      cashierName,
      tableNumber: b.table?.table_number ?? null,
      printedAt: new Date(),
      reprint: b.receipt?.print_count,
    };
  }, [kind, id, r.id]);
}
