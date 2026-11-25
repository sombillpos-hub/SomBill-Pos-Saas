import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { hospitalityStore } from '../modules/pos/hospitalityStore.js';
import { realtimeChannel } from '../websocket/index.js';

const demoSchema = z.object({
  name: z.string().trim().min(2).max(120),
  business: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(80).default('Hargeisa'),
  phone: z.string().trim().min(6).max(40),
});

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(3).max(2000),
});

const newsletterSchema = z.object({
  email: z.string().trim().email(),
});

const webhookPaymentSchema = z.object({
  reference: z.string().trim().min(1),
  orderId: z.string().trim().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().default('USD'),
  status: z.enum(['completed', 'failed', 'pending']).default('completed'),
  payerPhone: z.string().trim().optional(),
});

function verifyWebhookSignature(req: Request, secretEnvVar: string): boolean {
  const secret = process.env[secretEnvVar]?.trim();
  // When no merchant webhook secret is configured yet (dev/staging), allow open testing.
  if (!secret) return true;
  const sigHeader = String(req.headers['x-sombill-signature'] ?? req.headers['x-webhook-signature'] ?? '');
  if (!sigHeader) return false;
  const expected = createHmac('sha256', secret)
    .update(JSON.stringify(req.body ?? {}))
    .digest('hex');
  const a = Buffer.from(sigHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Public Website integration endpoints (Demo bookings, Contact form, Newsletter)
 * + Mobile Money Payment Gateway Webhook receivers (Telesom ZAAD, Hormuud EVC Plus, Somtel e-Dahab).
 */
export function publicRoutes(): Router {
  const router = Router();

  // ---- Website Leads & Forms -------------------------------------------------------------------------------
  router.post('/public/demo-requests', (req: Request, res: Response) => {
    const parsed = demoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid demo request fields', details: parsed.error.flatten() });
    }
    const lead = hospitalityStore.addDemoRequest(parsed.data);
    realtimeChannel.broadcast('*', 'lead.demo_requested', lead);
    return res.status(201).json({ data: lead });
  });

  router.post('/public/contact', (req: Request, res: Response) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid contact form fields', details: parsed.error.flatten() });
    }
    const lead = hospitalityStore.addContactLead(parsed.data);
    return res.status(201).json({ data: lead });
  });

  router.post('/public/newsletter', (req: Request, res: Response) => {
    const parsed = newsletterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    const sub = hospitalityStore.addNewsletter(parsed.data.email);
    return res.status(201).json({ data: sub });
  });

  router.get('/public/leads', (_req: Request, res: Response) => {
    res.json({
      data: {
        demoRequests: hospitalityStore.demoRequests,
        contactLeads: hospitalityStore.contactLeads,
        newsletterSubscribers: hospitalityStore.newsletterSubscribers,
      },
    });
  });

  // ---- Payment Gateway Webhooks (ZAAD, EVC Plus, e-Dahab) --------------------------------------------------
  const providers: Array<{ slug: string; method: string; secretEnv: string }> = [
    { slug: 'zaad', method: 'zaad', secretEnv: 'ZAAD_WEBHOOK_SECRET' },
    { slug: 'evc-plus', method: 'evc_plus', secretEnv: 'EVC_PLUS_WEBHOOK_SECRET' },
    { slug: 'edahab', method: 'somtel_money', secretEnv: 'EDAHAB_WEBHOOK_SECRET' },
  ];

  for (const provider of providers) {
    router.post(`/webhooks/payments/${provider.slug}`, (req: Request, res: Response) => {
      if (!verifyWebhookSignature(req, provider.secretEnv)) {
        return res.status(401).json({ error: `Invalid ${provider.slug} webhook signature` });
      }
      const parsed = webhookPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payment webhook payload', details: parsed.error.flatten() });
      }
      const payment = hospitalityStore.create(
        'payments',
        {
          method: provider.method,
          order_id: parsed.data.orderId ?? null,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          reference: parsed.data.reference,
          payer_phone: parsed.data.payerPhone ?? null,
          status: parsed.data.status,
          verification_status: parsed.data.status === 'completed' ? 'verified' : 'pending',
          source: `webhook:${provider.slug}`,
        },
        'payment.webhook_received',
      );
      return res.status(200).json({ received: true, provider: provider.slug, data: payment });
    });
  }

  return router;
}
