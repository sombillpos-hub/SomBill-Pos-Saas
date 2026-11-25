import { supabase, unwrap } from '@sombill/api-client/supabase';
import type {
  CashierShift,
  Customer,
  Order,
  OrderItem,
  Payment,
  Profile,
  ReceiptRecord,
  Refund,
  RestaurantTable,
} from '@sombill/shared-types/types';

export interface OrderBundle {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  refunds: Refund[];
  table: RestaurantTable | null;
  customer: Customer | null;
  receipt: ReceiptRecord | null;
}

export async function fetchOrderBundle(orderId: string): Promise<OrderBundle | null> {
  const order = unwrap(await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()) as Order | null;
  if (!order) return null;
  const [items, payments, refunds, table, customer, receipt] = await Promise.all([
    supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
      .then((x) => unwrap(x) as OrderItem[]),
    supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
      .then((x) => unwrap(x) as Payment[]),
    supabase
      .from('refunds')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
      .then((x) => unwrap(x) as Refund[]),
    order.table_id
      ? supabase
          .from('restaurant_tables')
          .select('*')
          .eq('id', order.table_id)
          .maybeSingle()
          .then((x) => unwrap(x) as RestaurantTable | null)
      : Promise.resolve(null),
    order.customer_id
      ? supabase
          .from('customers')
          .select('*')
          .eq('id', order.customer_id)
          .maybeSingle()
          .then((x) => unwrap(x) as Customer | null)
      : Promise.resolve(null),
    supabase
      .from('receipts')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()
      .then((x) => unwrap(x) as ReceiptRecord | null),
  ]);
  return { order, items, payments, refunds, table, customer, receipt };
}

export const fetchOpenCashierShift = async (rid: string, uid: string) =>
  unwrap(
    await supabase
      .from('cashier_shifts')
      .select('*')
      .eq('restaurant_id', rid)
      .eq('cashier_id', uid)
      .eq('status', 'open')
      .maybeSingle(),
  ) as CashierShift | null;

export async function profileName(uid: string | null | undefined): Promise<string> {
  if (!uid) return '—';
  const p = unwrap(await supabase.from('profiles').select('full_name,email').eq('id', uid).maybeSingle()) as Pick<
    Profile,
    'full_name' | 'email'
  > | null;
  return p?.full_name || p?.email || '—';
}

/** Prints a SomBill print page in a hidden iframe (same origin, same session). */
export function printDocument(path: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    const done = () => {
      window.removeEventListener('message', onMsg);
      setTimeout(() => iframe.remove(), 500);
      resolve();
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow && e.data === 'sombill-printed') done();
    };
    window.addEventListener('message', onMsg);
    setTimeout(done, 120000);
    iframe.src = `${path}${path.includes('?') ? '&' : '?'}autoprint=1`;
    document.body.appendChild(iframe);
  });
}
