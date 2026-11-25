import { supabase, unwrap } from '@sombill/api-client/supabase';
import type { AppRole } from '@sombill/shared-types/types';
import type {
  AuditReview,
  AuditRow,
  Branch,
  BranchSummary,
  InventorySummary,
  LowStockRow,
  MenuMatrixRow,
  PayMixRow,
  PushResult,
  ReviewStatus,
  SeriesPoint,
  StaffRow,
  TaxDueRow,
  TaxFiling,
} from '../features/types';

/** PostgREST returns `numeric` columns as strings; the UI works in numbers. */
const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const mapNums = <T extends object>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row };
  for (const k of keys) (out as Record<keyof T, unknown>)[k] = n(row[k]);
  return out;
};
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---- branches ------------------------------------------------------------------------------------------------
export async function listBranches(orgId: string): Promise<Branch[]> {
  const rows = unwrap(
    await supabase
      .from('restaurants')
      .select('id,name,address,phone,email,currency,timezone,tax_rate,tax_label,tax_inclusive,receipt_footer,settings')
      .eq('organization_id', orgId)
      .order('name'),
  ) as Branch[];
  return rows.map((r) => mapNums(r, ['tax_rate']));
}

export async function createBranch(
  orgId: string,
  b: { name: string; currency: string; timezone: string; address: string; phone: string; taxRate: number },
): Promise<string> {
  return unwrap(
    await supabase.rpc('org_create_branch', {
      p_org: orgId,
      p_name: b.name,
      p_currency: b.currency,
      p_timezone: b.timezone,
      p_address: b.address,
      p_phone: b.phone,
      p_tax_rate: b.taxRate,
    }),
  ) as string;
}

export async function updateBranch(
  id: string,
  patch: Partial<Pick<Branch, 'name' | 'address' | 'phone' | 'email' | 'timezone'>>,
): Promise<void> {
  unwrap(await supabase.from('restaurants').update(patch).eq('id', id).select('id').single());
}

// ---- read models ---------------------------------------------------------------------------------------------
export async function branchSummary(orgId: string, from: Date, to: Date): Promise<BranchSummary[]> {
  const rows = unwrap(
    await supabase.rpc('org_branch_summary', { p_org: orgId, p_from: iso(from), p_to: iso(to) }),
  ) as BranchSummary[];
  return (rows ?? []).map((r) =>
    mapNums(r, [
      'tax_rate',
      'orders_count',
      'gross',
      'net',
      'tax',
      'discounts',
      'guests',
      'cancelled_count',
      'collected',
      'refunded',
      'open_orders',
      'tables_total',
      'tables_occupied',
      'open_cashier_shifts',
      'staff_on_duty',
      'staff_active',
    ]),
  );
}

export async function revenueSeries(
  orgId: string,
  from: Date,
  to: Date,
  bucket: 'hour' | 'day' | 'month',
): Promise<SeriesPoint[]> {
  const rows = unwrap(
    await supabase.rpc('org_revenue_series', { p_org: orgId, p_from: iso(from), p_to: iso(to), p_bucket: bucket }),
  ) as SeriesPoint[];
  return (rows ?? []).map((r) => mapNums(r, ['gross', 'orders']));
}

export async function paymentMix(orgId: string, from: Date, to: Date): Promise<PayMixRow[]> {
  const rows = unwrap(
    await supabase.rpc('org_payment_mix', { p_org: orgId, p_from: iso(from), p_to: iso(to) }),
  ) as PayMixRow[];
  return (rows ?? []).map((r) => mapNums(r, ['amount', 'txns']));
}

export async function inventorySummary(orgId: string): Promise<InventorySummary[]> {
  const rows = unwrap(await supabase.rpc('org_inventory_summary', { p_org: orgId })) as InventorySummary[];
  return (rows ?? []).map((r) =>
    mapNums(r, ['items', 'low_stock', 'out_of_stock', 'stock_value', 'open_purchase_orders', 'open_po_value']),
  );
}

export async function lowStock(orgId: string, limit = 100): Promise<LowStockRow[]> {
  const rows = unwrap(await supabase.rpc('org_low_stock', { p_org: orgId, p_limit: limit })) as LowStockRow[];
  return (rows ?? []).map((r) => mapNums(r, ['quantity', 'min_stock']));
}

// ---- central menu --------------------------------------------------------------------------------------------
export async function menuMatrix(orgId: string): Promise<MenuMatrixRow[]> {
  const rows = unwrap(await supabase.rpc('org_menu_matrix', { p_org: orgId })) as MenuMatrixRow[];
  return (rows ?? []).map((r) => mapNums(r, ['price']));
}

export interface PushArgs {
  name: string;
  targets: string[];
  price: number | null;
  available: boolean | null;
  createMissing: boolean;
  category: string | null;
}
export async function pushMenuItem(orgId: string, a: PushArgs): Promise<PushResult[]> {
  return unwrap<PushResult[]>(
    await supabase.rpc('org_push_menu_item', {
      p_org: orgId,
      p_name: a.name,
      p_targets: a.targets,
      p_price: a.price,
      p_available: a.available,
      p_create_missing: a.createMissing,
      p_category: a.category,
    }),
  );
}

export async function pushHistory(branchIds: string[], limit = 30): Promise<AuditRow[]> {
  if (!branchIds.length) return [];
  return unwrap(
    await supabase
      .from('audit_logs')
      .select('*')
      .in('restaurant_id', branchIds)
      .eq('action', 'menu_push')
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as AuditRow[];
}

// ---- broadcast -----------------------------------------------------------------------------------------------
export async function broadcast(
  orgId: string,
  branch: string | null,
  title: string,
  body: string,
  roles: AppRole[] | null,
): Promise<number> {
  return n(
    unwrap(
      await supabase.rpc('org_broadcast', {
        p_org: orgId,
        p_branch: branch,
        p_title: title,
        p_body: body || null,
        p_roles: roles && roles.length ? roles : null,
      }),
    ),
  );
}

// ---- tax -----------------------------------------------------------------------------------------------------
export async function taxDue(orgId: string, from: Date, to: Date): Promise<TaxDueRow[]> {
  const rows = unwrap(
    await supabase.rpc('org_tax_due', { p_org: orgId, p_from: ymd(from), p_to: ymd(to) }),
  ) as TaxDueRow[];
  return (rows ?? []).map((r) => mapNums(r, ['tax_rate', 'taxable_sales', 'tax_collected', 'orders_count']));
}
export async function recordTaxFiling(
  orgId: string,
  restaurantId: string,
  from: Date,
  to: Date,
  reference: string,
  notes: string,
): Promise<string> {
  return unwrap(
    await supabase.rpc('org_record_tax_filing', {
      p_org: orgId,
      p_restaurant: restaurantId,
      p_from: ymd(from),
      p_to: ymd(to),
      p_reference: reference || null,
      p_notes: notes || null,
    }),
  ) as string;
}
export async function taxFilings(orgId: string): Promise<TaxFiling[]> {
  const rows = unwrap(
    await supabase
      .from('tax_filings')
      .select('*')
      .eq('organization_id', orgId)
      .order('filed_at', { ascending: false })
      .limit(200),
  ) as TaxFiling[];
  return rows.map((r) => mapNums(r, ['tax_collected']));
}

// ---- settings ------------------------------------------------------------------------------------------------
export async function updateSettings(
  orgId: string,
  name: string,
  reporting: string,
  rates: Record<string, number>,
): Promise<void> {
  unwrap(
    await supabase.rpc('org_update_settings', {
      p_org: orgId,
      p_name: name,
      p_reporting_currency: reporting,
      p_fx_rates: rates,
    }),
  );
}
export async function applyDefaults(
  orgId: string,
  targets: string[],
  fields: Record<string, unknown>,
): Promise<number> {
  return n(
    unwrap(
      await supabase.rpc('org_apply_branch_defaults', {
        p_org: orgId,
        p_targets: targets,
        p_fields: fields as Record<string, never>,
      }),
    ),
  );
}

// ---- audit & anti-fraud --------------------------------------------------------------------------------------
/** Audit rows of the given branches. Discount rows get the order subtotal added so the percentage can be judged. */
export async function auditFeed(branchIds: string[], from: Date, limit = 400): Promise<AuditRow[]> {
  if (!branchIds.length) return [];
  const rows = unwrap(
    await supabase
      .from('audit_logs')
      .select('*')
      .in('restaurant_id', branchIds)
      .in('action', [
        'delete',
        'shift_close',
        'refund',
        'cancel',
        'discount',
        'payment_rejected',
        'receipt_reprint',
        'price_change',
      ])
      .gte('created_at', iso(from))
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as AuditRow[];
  const orderIds = [
    ...new Set(rows.filter((r) => r.action === 'discount' && r.entity_id).map((r) => r.entity_id as string)),
  ];
  if (!orderIds.length) return rows;
  const orders = unwrap(await supabase.from('orders').select('id,subtotal').in('id', orderIds)) as {
    id: string;
    subtotal: number | string;
  }[];
  const sub = new Map(orders.map((o) => [o.id, n(o.subtotal)]));
  return rows.map((r) =>
    r.action === 'discount' && r.entity_id && sub.has(r.entity_id)
      ? { ...r, new_data: { ...(r.new_data ?? {}), subtotal: sub.get(r.entity_id) } }
      : r,
  );
}

export async function auditReviews(orgId: string): Promise<AuditReview[]> {
  return unwrap(
    await supabase
      .from('audit_reviews')
      .select('event_key,status,note,reviewed_at')
      .eq('organization_id', orgId)
      .limit(2000),
  ) as AuditReview[];
}
export async function reviewEvent(
  orgId: string,
  key: string,
  status: ReviewStatus,
  note: string,
  uid: string,
): Promise<void> {
  unwrap(
    await supabase
      .from('audit_reviews')
      .upsert(
        {
          organization_id: orgId,
          event_key: key,
          status,
          note: note || null,
          reviewed_by: uid,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,event_key' },
      )
      .select('event_key')
      .single(),
  );
}

// ---- people & registers --------------------------------------------------------------------------------------
export async function staffList(branchIds: string[]): Promise<StaffRow[]> {
  if (!branchIds.length) return [];
  const members = unwrap(
    await supabase
      .from('restaurant_members')
      .select('id,restaurant_id,user_id,role,status,created_at')
      .in('restaurant_id', branchIds),
  ) as Omit<StaffRow, 'full_name' | 'email' | 'phone' | 'last_login_at'>[];
  const ids = [...new Set(members.map((m) => m.user_id))];
  const profiles = ids.length
    ? (unwrap(await supabase.from('profiles').select('id,full_name,email,phone,last_login_at').in('id', ids)) as {
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        last_login_at: string | null;
      }[])
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return members.map((m) => {
    const p = byId.get(m.user_id);
    return {
      ...m,
      full_name: p?.full_name || p?.email || 'Unknown',
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      last_login_at: p?.last_login_at ?? null,
    };
  });
}

export interface OpenRegister {
  id: string;
  restaurant_id: string;
  cashier_id: string;
  opened_at: string;
  opening_cash: number;
  cashier_name: string;
}
export async function openRegisters(branchIds: string[]): Promise<OpenRegister[]> {
  if (!branchIds.length) return [];
  const rows = unwrap(
    await supabase
      .from('cashier_shifts')
      .select('id,restaurant_id,cashier_id,opened_at,opening_cash')
      .in('restaurant_id', branchIds)
      .eq('status', 'open'),
  ) as Omit<OpenRegister, 'cashier_name'>[];
  const names = await nameMap(rows.map((r) => r.cashier_id));
  return rows.map((r) => ({
    ...r,
    opening_cash: n(r.opening_cash),
    cashier_name: names.get(r.cashier_id) ?? 'Cashier',
  }));
}

export interface OnDuty {
  id: string;
  restaurant_id: string;
  user_id: string;
  started_at: string;
  name: string;
  role: AppRole | null;
}
export async function staffOnDuty(branchIds: string[]): Promise<OnDuty[]> {
  if (!branchIds.length) return [];
  const rows = unwrap(
    await supabase
      .from('staff_shifts')
      .select('id,restaurant_id,user_id,started_at')
      .in('restaurant_id', branchIds)
      .is('ended_at', null),
  ) as Omit<OnDuty, 'name' | 'role'>[];
  const names = await nameMap(rows.map((r) => r.user_id));
  const members = rows.length
    ? (unwrap(
        await supabase.from('restaurant_members').select('restaurant_id,user_id,role').in('restaurant_id', branchIds),
      ) as { restaurant_id: string; user_id: string; role: AppRole }[])
    : [];
  const role = new Map(members.map((m) => [`${m.restaurant_id}:${m.user_id}`, m.role]));
  return rows.map((r) => ({
    ...r,
    name: names.get(r.user_id) ?? 'Staff',
    role: role.get(`${r.restaurant_id}:${r.user_id}`) ?? null,
  }));
}

export async function nameMap(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = unwrap(await supabase.from('profiles').select('id,full_name,email').in('id', ids)) as {
    id: string;
    full_name: string;
    email: string | null;
  }[];
  return new Map(rows.map((p) => [p.id, p.full_name || p.email || 'Unknown']));
}

// ---- mobile money --------------------------------------------------------------------------------------------
export interface PendingPayment {
  id: string;
  restaurant_id: string;
  order_id: string;
  method: string;
  amount: number;
  reference: string | null;
  created_at: string;
  order_number: number | null;
}
export async function pendingPayments(branchIds: string[]): Promise<PendingPayment[]> {
  if (!branchIds.length) return [];
  const rows = unwrap(
    await supabase
      .from('payments')
      .select('id,restaurant_id,order_id,method,amount,reference,created_at,orders(order_number)')
      .in('restaurant_id', branchIds)
      .eq('status', 'pending')
      .eq('kind', 'payment')
      .order('created_at', { ascending: false })
      .limit(200),
  ) as unknown as (Omit<PendingPayment, 'order_number'> & { orders: { order_number: number } | null })[];
  return rows.map(({ orders, ...r }) => ({ ...r, amount: n(r.amount), order_number: orders?.order_number ?? null }));
}
export async function verifyPayment(paymentId: string, approve: boolean, note: string): Promise<void> {
  unwrap(await supabase.rpc('verify_payment', { p_payment: paymentId, p_approve: approve, p_note: note || null }));
}

// ---- staff provisioning (Edge Function: runs with the service role, checks the caller is manager or group owner) ----
export async function staffAction(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = (await ctx.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* keep generic */
      }
    }
    throw new Error(msg);
  }
  return data;
}
