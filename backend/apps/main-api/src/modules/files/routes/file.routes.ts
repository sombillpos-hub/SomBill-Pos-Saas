import { Router } from 'express';
import { authenticate, type AccessTokenVerifier } from '@sombill/authentication';
import { validate } from '@sombill/validation';
import { singleFileUpload } from '../../../middleware/upload.js';
import { FileController } from '../controllers/file.controller.js';
import type { FilesService } from '../services/file.service.js';
import { fileParams, listFilesQuery, uploadFileBody } from '../validators/file.validator.js';

/** POST /files (multipart) · GET /files · GET /files/:fileId · GET /files/:fileId/content · DELETE /files/:fileId */
export function filesRouter(deps: { files: FilesService; verify: AccessTokenVerifier; maxBytes: number }): Router {
  const c = new FileController(deps.files);
  const router = Router();
  // Authenticate before reading the multipart body, so anonymous uploads are never buffered.
  router.use(authenticate(deps.verify));
  router.post('/', singleFileUpload('file', deps.maxBytes), validate({ body: uploadFileBody }), c.upload);
  router.get('/', validate({ query: listFilesQuery }), c.list);
  router.get('/:fileId', validate({ params: fileParams }), c.get);
  router.get('/:fileId/content', validate({ params: fileParams }), c.content);
  router.delete('/:fileId', validate({ params: fileParams }), c.remove);
  return router;
}
