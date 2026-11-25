import type { Request, Response } from 'express';
import { ALL_PERMISSIONS } from '@sombill/shared-types';
import { sendOk } from '@sombill/shared-utils';

export class PermissionController {
  /** The permission catalogue (codes from @sombill/shared-types). */
  list = (_req: Request, res: Response) => {
    sendOk(res, ALL_PERMISSIONS);
  };
}
