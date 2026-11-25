import type { RequestHandler } from 'express';
import { API_PREFIX } from '../routes/routeTable.js';

export const API_VERSION = '1';

/**
 * API versioning: the version is part of the URL (`/api/v1/...`). Every versioned response also carries
 * `API-Version`, so clients and logs can tell which contract answered. A future `/api/v2` gets its own prefix
 * and route table entry; v1 keeps working until it is retired.
 */
export const apiVersionHeader: RequestHandler = (req, res, next) => {
  if (req.path.startsWith(`${API_PREFIX}/`)) res.setHeader('API-Version', API_VERSION);
  next();
};
