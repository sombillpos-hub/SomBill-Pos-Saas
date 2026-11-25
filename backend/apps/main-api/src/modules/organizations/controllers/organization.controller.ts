import type { Request, Response } from 'express';
import { requirePrincipal } from '@sombill/authentication';
import { input } from '@sombill/validation';
import { sendCreated, sendOk, sendPage, type PaginationQuery } from '@sombill/shared-utils';
import { requestContext } from '../../../middleware/requestContext.js';
import type { BranchesService } from '../../branches/services/branch.service.js';
import type { CreateBranchBody, ListBranchesQuery } from '../../branches/validators/branch.validator.js';
import type { OrganizationsService } from '../services/organization.service.js';
import type { CreateOrganizationBody, UpdateOrganizationBody } from '../validators/organization.validator.js';

type OrgParams = { organizationId: string };

export class OrganizationController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly branches: BranchesService,
  ) {}

  create = async (req: Request, res: Response) => {
    const { body } = input<CreateOrganizationBody>(req);
    sendCreated(res, await this.organizations.create(requirePrincipal(req), body, requestContext(req)));
  };

  list = async (req: Request, res: Response) => {
    const { query } = input<unknown, PaginationQuery>(req);
    const { items, total } = await this.organizations.listMine(requirePrincipal(req), query);
    sendPage(res, items, query, total);
  };

  get = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, OrgParams>(req);
    sendOk(res, await this.organizations.get(requirePrincipal(req), params.organizationId));
  };

  update = async (req: Request, res: Response) => {
    const { params, body } = input<UpdateOrganizationBody, unknown, OrgParams>(req);
    sendOk(
      res,
      await this.organizations.update(requirePrincipal(req), params.organizationId, body, requestContext(req)),
    );
  };

  subscription = async (req: Request, res: Response) => {
    const { params } = input<unknown, unknown, OrgParams>(req);
    sendOk(res, await this.organizations.subscription(requirePrincipal(req), params.organizationId));
  };

  createBranch = async (req: Request, res: Response) => {
    const { params, body } = input<CreateBranchBody, unknown, OrgParams>(req);
    sendCreated(
      res,
      await this.branches.create(requirePrincipal(req), params.organizationId, body, requestContext(req)),
    );
  };

  listBranches = async (req: Request, res: Response) => {
    const { params, query } = input<unknown, ListBranchesQuery, OrgParams>(req);
    const { items, total } = await this.branches.list(requirePrincipal(req), params.organizationId, query);
    sendPage(res, items, query, total);
  };
}
