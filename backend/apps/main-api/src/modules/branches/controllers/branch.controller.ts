import type { Request, Response } from 'express';
import { requirePrincipal } from '@sombill/authentication';
import { input } from '@sombill/validation';
import { sendOk } from '@sombill/shared-utils';
import { requestContext } from '../../../middleware/requestContext.js';
import type { BranchesService } from '../services/branch.service.js';
import type { BranchSettingsBody, UpdateBranchBody } from '../validators/branch.validator.js';

type Params = { branchId: string };

export class BranchController {
  constructor(private readonly branches: BranchesService) {}

  get = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, Params>(req);
    sendOk(res, await this.branches.get(requirePrincipal(req), params.branchId));
  };

  update = async (req: Request, res: Response) => {
    const { params, body } = input<UpdateBranchBody, unknown, Params>(req);
    sendOk(res, await this.branches.update(requirePrincipal(req), params.branchId, body, requestContext(req)));
  };

  getSettings = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, Params>(req);
    sendOk(res, await this.branches.getSettings(requirePrincipal(req), params.branchId));
  };

  updateSettings = async (req: Request, res: Response) => {
    const { params, body } = input<BranchSettingsBody, unknown, Params>(req);
    sendOk(res, await this.branches.updateSettings(requirePrincipal(req), params.branchId, body, requestContext(req)));
  };
}
