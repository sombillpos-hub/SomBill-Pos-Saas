import { fetchAll, supabase, unwrap } from '@sombill/api-client/supabase';
import type { AppNotification, Order, OrderItem, Payment, StaffShift } from '@sombill/shared-types/types';
import { ACTIVE_STATUSES } from '@sombill/shared-utils/posRules';

export const fetchActiveOrders = (rid: string) =>
  fetchAll<Order>((a, b) =>
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', rid)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .range(a, b),
  );

export const fetchOrdersBetween = (
  rid: string,
  fromIso: string,
  toIso: string,
  waiterId?: string,
  includeUnassigned = false,
) =>
  fetchAll<Order>((a, b) => {
    let q = supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', rid)
      .gte('created_at', fromIso)
      .lt('created_at', toIso);
    if (waiterId) {
      q = includeUnassigned ? q.or(`waiter_id.eq.${waiterId},waiter_id.is.null`) : q.eq('waiter_id', waiterId);
    }
    return q.order('created_at', { ascending: false }).range(a, b);
  });

export async function fetchItemsFor(orderIds: string[]): Promise<OrderItem[]> {
  if (!orderIds.length) return [];
  const out: OrderItem[] = [];
  for (let i = 0; i < orderIds.length; i += 100) {
    out.push(
      ...(unwrap(
        await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds.slice(i, i + 100))
          .order('created_at'),
      ) as OrderItem[]),
    );
  }
  return out;
}

export async function fetchPaymentsFor(orderIds: string[]): Promise<Payment[]> {
  if (!orderIds.length) return [];
  return unwrap(await supabase.from('payments').select('*').in('order_id', orderIds).order('created_at')) as Payment[];
}

export const fetchNotifications = async (userId: string, limit = 100) =>
  unwrap(
    await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as AppNotification[];

export const fetchOpenShift = async (rid: string, userId: string) =>
  unwrap(
    await supabase
      .from('staff_shifts')
      .select('*')
      .eq('restaurant_id', rid)
      .eq('user_id', userId)
      .is('ended_at', null)
      .maybeSingle(),
  ) as StaffShift | null;

/** Groups items by order id. */
export function itemsByOrder(items: OrderItem[]): Map<string, OrderItem[]> {
  const m = new Map<string, OrderItem[]>();
  for (const it of items) {
    const l = m.get(it.order_id) ?? [];
    l.push(it);
    m.set(it.order_id, l);
  }
  return m;
}
