import type { Request, Response } from 'express';
import { requirePrincipal } from '@sombill/authentication';
import { input } from '@sombill/validation';
import { sendCreated, sendNoContent, sendOk, sendPage } from '@sombill/shared-utils';
import { requestContext } from '../../../middleware/requestContext.js';
import type { FilesService } from '../services/file.service.js';
import type { ListFilesQuery, UploadFileBody } from '../validators/file.validator.js';

type Params = { fileId: string };

export class FileController {
  constructor(private readonly files: FilesService) {}

  upload = async (req: Request, res: Response) => {
    const { body } = input<UploadFileBody>(req);
    const f = req.file as Express.Multer.File;
    const view = await this.files.upload(
      requirePrincipal(req),
      body,
      { originalName: f.originalname, buffer: f.buffer },
      requestContext(req),
    );
    sendCreated(res, view);
  };

  list = async (req: Request, res: Response) => {
    const { query } = input<unknown, ListFilesQuery>(req);
    const { items, total } = await this.files.list(requirePrincipal(req), query);
    sendPage(res, items, query, total);
  };

  get = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, Params>(req);
    sendOk(res, await this.files.get(requirePrincipal(req), params.fileId));
  };

  content = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, Params>(req);
    const { file, bytes } = await this.files.content(requirePrincipal(req), params.fileId);
    const inline = file.contentType.startsWith('image/') || file.contentType === 'application/pdf';
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', `"${file.checksumSha256}"`);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    res.status(200).end(Buffer.from(bytes));
  };

  remove = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, Params>(req);
    await this.files.remove(requirePrincipal(req), params.fileId, requestContext(req));
    sendNoContent(res);
  };
}
