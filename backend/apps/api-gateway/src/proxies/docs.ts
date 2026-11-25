import type { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

const SPECS = [
  { name: 'Identity & Auth', id: 'identity' },
  { name: 'Organizations & Branches', id: 'organization' },
] as const;

/** Swagger UI at /api/docs (relaxed CSP only for that page); specs are fetched live from the main API. */
export function mountDocs(app: Express, mainApiUrl: string): void {
  app.get('/api/docs/:spec.json', async (req, res) => {
    const spec = SPECS.find((s) => s.id === req.params.spec);
    if (!spec) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API spec.' } });
    try {
      const upstream = await fetch(new URL(`/openapi/${spec.id}.json`, mainApiUrl), {
        signal: AbortSignal.timeout(5000),
      });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(502).json({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The service is not reachable.' } });
    }
  });
  app.use(
    '/api/docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      explorer: true,
      customSiteTitle: 'SomBill API',
      swaggerOptions: { urls: SPECS.map((s) => ({ name: s.name, url: `/api/docs/${s.id}.json` })) },
    }),
  );
}
