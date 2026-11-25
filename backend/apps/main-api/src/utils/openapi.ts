import type { Express } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { buildOpenApiDocument, type OpenApiInfo } from '@sombill/shared-utils';

/** Serves one module's machine-readable spec at GET /openapi/<id>.json (the gateway's Swagger UI reads these). */
export function mountModuleOpenApi(app: Express, id: string, registry: OpenAPIRegistry, info: OpenApiInfo): void {
  const doc = buildOpenApiDocument(registry, info);
  app.get(`/openapi/${id}.json`, (_req, res) => {
    res.json(doc);
  });
}
