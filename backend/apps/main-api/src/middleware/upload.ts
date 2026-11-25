import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '@sombill/shared-utils';

/**
 * Parses one multipart file field into memory (`req.file`), with a hard size limit and a single file per request.
 * Memory storage is safe here because the limit is small (default 5 MB) and the bytes are validated by content
 * before anything is written to storage.
 */
export function singleFileUpload(field: string, maxBytes: number): RequestHandler {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 1024, parts: 12 },
  }).single(field);
  return (req, res, next) => {
    parse(req, res, (err: unknown) => {
      if (!err) {
        if (!req.file) return next(new AppError(400, 'FILE_REQUIRED', `Attach the file in the "${field}" field.`));
        return next();
      }
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(413, 'FILE_TOO_LARGE', `The file is larger than ${Math.floor(maxBytes / 1024 / 1024)} MB.`),
          );
        }
        return next(new AppError(400, 'INVALID_UPLOAD', err.message));
      }
      // Anything else thrown while parsing is a malformed request body (bad boundary, broken part header, ...).
      next(new AppError(400, 'INVALID_UPLOAD', 'The upload could not be read. Send multipart/form-data.'));
    });
  };
}
