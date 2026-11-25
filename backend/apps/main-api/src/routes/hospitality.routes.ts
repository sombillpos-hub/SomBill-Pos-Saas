import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { hospitalityStore, type CollectionName } from '../modules/pos/hospitalityStore.js';
import { realtimeChannel } from '../websocket/index.js';

const branchOf = (req: Request): string | undefined =>
  typeof req.query.branchId === 'string' && req.query.branchId.trim() ? req.query.branchId.trim() : undefined;

const idOf = (req: Request): string => String(req.params.id ?? '');

function mountCrud(router: Router, basePath: string, collection: CollectionName, eventPrefix: string) {
  router.get(basePath, (req: Request, res: Response) => {
    res.json({ data: hospitalityStore.list(collection, branchOf(req)) });
  });

  router.get(`${basePath}/:id`, (req: Request, res: Response) => {
    const item = hospitalityStore.get(collection, idOf(req));
    if (!item) return res.status(404).json({ error: `${collection} record not found` });
    return res.json({ data: item });
  });

  router.post(basePath, (req: Request, res: Response) => {
    const body = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
    const created = hospitalityStore.create(collection, body, `${eventPrefix}.created`);
    return res.status(201).json({ data: created });
  });

  router.patch(`${basePath}/:id`, (req: Request, res: Response) => {
    const body = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
    const updated = hospitalityStore.update(collection, idOf(req), body, `${eventPrefix}.updated`);
    if (!updated) return res.status(404).json({ error: `${collection} record not found` });
    return res.json({ data: updated });
  });

  router.delete(`${basePath}/:id`, (req: Request, res: Response) => {
    const ok = hospitalityStore.remove(collection, idOf(req), `${eventPrefix}.deleted`);
    if (!ok) return res.status(404).json({ error: `${collection} record not found` });
    return res.status(204).end();
  });
}

const kitchenStatusSchema = z.object({
  status: z.enum(['new', 'pending', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
});

const stockAdjustSchema = z.object({
  delta: z.number(),
  reason: z.string().optional(),
});

/**
 * Full Hospitality, POS, Kitchen, Cash Management, Supply Chain, Reporting & Realtime routes.
 * Mounted directly behind /api/v1/* via the API Gateway.
 */
export function hospitalityRoutes(): Router {
  const router = Router();

  // ---- Core CRUD collections -------------------------------------------------------------------------------
  mountCrud(router, '/categories', 'categories', 'category');
  mountCrud(router, '/products', 'products', 'product');
  mountCrud(router, '/menu', 'products', 'menu');
  mountCrud(router, '/tables', 'tables', 'table');
  mountCrud(router, '/orders', 'orders', 'order');
  mountCrud(router, '/payments', 'payments', 'payment');
  mountCrud(router, '/shifts', 'shifts', 'shift');
  mountCrud(router, '/cash-management', 'shifts', 'shift');
  mountCrud(router, '/inventory', 'inventory', 'inventory');
  mountCrud(router, '/suppliers', 'suppliers', 'supplier');
  mountCrud(router, '/purchase-orders', 'purchaseOrders', 'purchase_order');
  mountCrud(router, '/purchasing', 'purchaseOrders', 'purchase_order');
  mountCrud(router, '/expenses', 'expenses', 'expense');
  mountCrud(router, '/customers', 'customers', 'customer');
  mountCrud(router, '/notifications', 'notifications', 'notification');
  mountCrud(router, '/audit-logs', 'auditLogs', 'audit');

  // ---- POS Terminal Bootstrap (single call for Cashier & Waiter startup) -----------------------------------
  router.get('/pos/bootstrap', (req: Request, res: Response) => {
    const branchId = branchOf(req);
    const openShift = hospitalityStore.list('shifts', branchId).find((s) => s.status === 'open') ?? null;
    res.json({
      data: {
        categories: hospitalityStore.list('categories', branchId),
        products: hospitalityStore.list('products', branchId),
        tables: hospitalityStore.list('tables', branchId),
        activeOrders: hospitalityStore
          .list('orders', branchId)
          .filter((o) => !['completed', 'cancelled'].includes(String(o.status))),
        openShift,
        realtimeClients: realtimeChannel.clientCount(),
      },
    });
  });

  // ---- Order workflow actions (bill request, cancel, kitchen status) ---------------------------------------
  router.post('/orders/:id/request-bill', (req: Request, res: Response) => {
    const updated = hospitalityStore.update(
      'orders',
      idOf(req),
      { bill_requested_at: new Date().toISOString() },
      'order.bill_requested',
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    return res.json({ data: updated });
  });

  router.post('/orders/:id/cancel', (req: Request, res: Response) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Cancelled via POS';
    const updated = hospitalityStore.update(
      'orders',
      idOf(req),
      { status: 'cancelled', cancel_reason: reason },
      'order.cancelled',
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    hospitalityStore.create('auditLogs', {
      branch_id: updated.branch_id,
      action: 'order.cancel',
      entity_type: 'order',
      entity_id: updated.id,
      reason,
      review_status: 'pending',
    });
    return res.json({ data: updated });
  });

  // ---- Kitchen Display System (KDS) ------------------------------------------------------------------------
  router.get('/kitchen/queue', (req: Request, res: Response) => {
    const queue = hospitalityStore
      .list('orders', branchOf(req))
      .filter((o) => ['new', 'pending', 'accepted', 'preparing', 'ready'].includes(String(o.status)));
    res.json({ data: queue });
  });

  router.patch('/kitchen/orders/:id/status', (req: Request, res: Response) => {
    const parsed = kitchenStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid kitchen order status' });
    const updated = hospitalityStore.update(
      'orders',
      idOf(req),
      { status: parsed.data.status },
      'kitchen.status_changed',
    );
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    return res.json({ data: updated });
  });

  // ---- Payment verification & refund -----------------------------------------------------------------------
  router.post('/payments/:id/verify', (req: Request, res: Response) => {
    const approved = req.body?.approved !== false;
    const updated = hospitalityStore.update(
      'payments',
      idOf(req),
      { verification_status: approved ? 'verified' : 'rejected', status: approved ? 'completed' : 'failed' },
      'payment.verified',
    );
    if (!updated) return res.status(404).json({ error: 'Payment not found' });
    return res.json({ data: updated });
  });

  router.post('/payments/:id/refund', (req: Request, res: Response) => {
    const updated = hospitalityStore.update(
      'payments',
      idOf(req),
      { status: 'refunded', refunded_at: new Date().toISOString() },
      'payment.refunded',
    );
    if (!updated) return res.status(404).json({ error: 'Payment not found' });
    return res.json({ data: updated });
  });

  // ---- Cash shift open / close -----------------------------------------------------------------------------
  router.get('/shifts/open', (req: Request, res: Response) => {
    const open = hospitalityStore.list('shifts', branchOf(req)).find((s) => s.status === 'open') ?? null;
    res.json({ data: open });
  });

  router.post('/shifts/:id/close', (req: Request, res: Response) => {
    const countedCash = Number(req.body?.counted_cash ?? 0);
    const updated = hospitalityStore.update(
      'shifts',
      idOf(req),
      { status: 'closed', counted_cash: countedCash, closed_at: new Date().toISOString() },
      'shift.closed',
    );
    if (!updated) return res.status(404).json({ error: 'Shift not found' });
    return res.json({ data: updated });
  });

  // ---- Inventory adjustment --------------------------------------------------------------------------------
  router.post('/inventory/:id/adjust', (req: Request, res: Response) => {
    const parsed = stockAdjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'delta (number) is required' });
    const existing = hospitalityStore.get('inventory', idOf(req));
    if (!existing) return res.status(404).json({ error: 'Inventory item not found' });
    const nextQty = Math.max(0, Number(existing.quantity ?? 0) + parsed.data.delta);
    const updated = hospitalityStore.update('inventory', idOf(req), { quantity: nextQty }, 'inventory.adjusted');
    return res.json({ data: updated });
  });

  // ---- Reports & Analytics summary -------------------------------------------------------------------------
  router.get('/reports/sales-summary', (req: Request, res: Response) => {
    const branchId = branchOf(req);
    const orders = hospitalityStore.list('orders', branchId).filter((o) => o.status !== 'cancelled');
    const payments = hospitalityStore.list('payments', branchId).filter((p) => p.status === 'completed');
    const grossSales = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const collected = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const byMethod = payments.reduce<Record<string, number>>((acc, p) => {
      const m = String(p.method ?? 'cash');
      acc[m] = (acc[m] ?? 0) + Number(p.amount ?? 0);
      return acc;
    }, {});
    res.json({
      data: {
        orders_count: orders.length,
        gross_sales: Number(grossSales.toFixed(2)),
        collected: Number(collected.toFixed(2)),
        outstanding: Number(Math.max(0, grossSales - collected).toFixed(2)),
        by_method: byMethod,
      },
    });
  });

  // ---- Notifications mark-read -----------------------------------------------------------------------------
  router.post('/notifications/:id/read', (req: Request, res: Response) => {
    const updated = hospitalityStore.update('notifications', idOf(req), { read_at: new Date().toISOString() });
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ data: updated });
  });

  // ---- Realtime SSE stream (Manager, Cashier, Waiter, Kitchen) ---------------------------------------------
  router.get('/realtime/stream', (req: Request, res: Response) => {
    const room = typeof req.query.room === 'string' && req.query.room.trim() ? req.query.room.trim() : '*';
    const unsubscribe = realtimeChannel.subscribe(room, res);
    req.on('close', unsubscribe);
  });

  return router;
}
