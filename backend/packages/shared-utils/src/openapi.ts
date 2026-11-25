import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import type { Express } from 'express';
import { z } from 'zod';

extendZodWithOpenApi(z);

export { OpenAPIRegistry };

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
  /** Public base path, e.g. /api/v1 */
  serverUrl: string;
}

/** Standard error and pagination components shared by every service spec. */
export function createRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.register(
    'Error',
    z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
        requestId: z.string().optional(),
      }),
    }),
  );
  registry.register(
    'PageMeta',
    z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  );
  return registry;
}

export const errorResponses = {
  400: {
    description: 'Validation error',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  401: {
    description: 'Not authenticated',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  403: {
    description: 'Not permitted',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  404: {
    description: 'Not found',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
} as const;

export function buildOpenApiDocument(
  registry: OpenAPIRegistry,
  info: OpenApiInfo,
): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: info.title, version: info.version, description: info.description },
    servers: [{ url: info.serverUrl }],
  });
}

/** Serves the machine-readable spec at GET /openapi.json (the gateway aggregates these). */
export function mountOpenApi(app: Express, registry: OpenAPIRegistry, info: OpenApiInfo): void {
  const doc = buildOpenApiDocument(registry, info);
  app.get('/openapi.json', (_req, res) => {
    res.json(doc);
  });
}
