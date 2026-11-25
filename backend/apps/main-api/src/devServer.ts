/* eslint-disable no-console -- CLI dev server startup banner */
import express from 'express';
import { hospitalityRoutes } from './routes/hospitality.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { realtimeChannel } from './websocket/index.js';

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// CORS: strictly aligned to SomBill Frontend (http://localhost:3000)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin || FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key,X-Request-Id');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

// Health & Service Info
app.get('/', (_req, res) => {
  res.json({
    service: 'SomBill Backend API',
    status: 'ok',
    port: PORT,
    frontend: FRONTEND_ORIGIN,
    endpoints: {
      health: '/health/live',
      posBootstrap: '/api/v1/pos/bootstrap',
      categories: '/api/v1/categories',
      products: '/api/v1/products',
      tables: '/api/v1/tables',
      orders: '/api/v1/orders',
      kitchen: '/api/v1/kitchen/queue',
      payments: '/api/v1/payments',
      shifts: '/api/v1/shifts',
      inventory: '/api/v1/inventory',
      suppliers: '/api/v1/suppliers',
      purchaseOrders: '/api/v1/purchase-orders',
      expenses: '/api/v1/expenses',
      customers: '/api/v1/customers',
      reports: '/api/v1/reports/sales-summary',
      notifications: '/api/v1/notifications',
      auditLogs: '/api/v1/audit-logs',
      publicLeads: '/api/v1/public/leads',
      realtimeStream: '/api/v1/realtime/stream',
      webhooks: [
        '/api/v1/webhooks/payments/zaad',
        '/api/v1/webhooks/payments/evc-plus',
        '/api/v1/webhooks/payments/edahab',
      ],
    },
  });
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok', service: 'sombill-backend', port: PORT, uptimeSec: Math.round(process.uptime()) });
});

app.get('/health/ready', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sombill-backend',
    realtimeClients: realtimeChannel.clientCount(),
  });
});

// Mount all Hospitality, POS, Website Leads, Payment Webhooks & Realtime SSE routes under /api/v1
app.use('/api/v1', hospitalityRoutes());
app.use('/api/v1', publicRoutes());

// 404 JSON fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

const server = app.listen(PORT, () => {
  const u = `http://localhost:${PORT}`;
  const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const c = (s: string) => `\x1b[36m${s}\x1b[0m`;
  const b = (s: string) => `\x1b[1m${s}\x1b[0m`;
  console.log(`
  ${b(g('SomBill'))} ${b('backend')}  (one server, port ${PORT})

  ${g('➜')}  ${b('Local:')}          ${c(u)}
     Health          ${u}/health/live
     POS Bootstrap   ${u}/api/v1/pos/bootstrap
     Orders API      ${u}/api/v1/orders
     Realtime SSE    ${u}/api/v1/realtime/stream
     Frontend CORS   ${FRONTEND_ORIGIN}

  Press Ctrl+C to stop.
`);
});

const shutdown = async () => {
  console.log('\nStopping SomBill backend server...');
  await realtimeChannel.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
