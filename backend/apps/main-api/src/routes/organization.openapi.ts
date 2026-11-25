import { z } from 'zod';
import { createRegistry, errorResponses, paginationQuery, type OpenAPIRegistry } from '@sombill/shared-utils';
import {
  branchSettingsBody,
  createBranchBody,
  listBranchesQuery,
  updateBranchBody,
} from '../modules/branches/validators/branch.validator.js';
import {
  createOrganizationBody,
  organizationView,
  updateOrganizationBody,
} from '../modules/organizations/validators/organization.validator.js';
import { listFilesQuery, uploadFileBody } from '../modules/files/validators/file.validator.js';

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const security = [{ bearerAuth: [] }];
const orgId = z.object({ organizationId: z.uuid() });
const branchId = z.object({ branchId: z.uuid() });
const common = { 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] };

export function organizationOpenApi(): OpenAPIRegistry {
  const r = createRegistry();
  const O = ['Organizations'];
  const B = ['Branches'];
  r.registerPath({
    method: 'post',
    path: '/organizations',
    tags: O,
    security,
    summary: 'Create an organization (14-day trial)',
    description:
      'The caller becomes owner asynchronously (identity consumes `organization.created`). Call `POST /auth/refresh` afterwards to receive the new membership in the access token.',
    request: { body: json(createOrganizationBody) },
    responses: {
      201: { description: 'Created', ...json(z.object({ data: organizationView })) },
      400: errorResponses[400],
      409: errorResponses[409],
      401: errorResponses[401],
    },
  });
  r.registerPath({
    method: 'get',
    path: '/organizations',
    tags: O,
    security,
    summary: 'Organizations I belong to',
    request: { query: paginationQuery },
    responses: { 200: { description: 'Page of organizations' }, 401: errorResponses[401] },
  });
  r.registerPath({
    method: 'get',
    path: '/organizations/{organizationId}',
    tags: O,
    security,
    summary: 'Get an organization',
    description: 'Requires `organization.read`.',
    request: { params: orgId },
    responses: { 200: { description: 'Organization', ...json(z.object({ data: organizationView })) }, ...common },
  });
  r.registerPath({
    method: 'patch',
    path: '/organizations/{organizationId}',
    tags: O,
    security,
    summary: 'Update an organization',
    description: 'Requires `organization.update` (owner).',
    request: { params: orgId, body: json(updateOrganizationBody) },
    responses: { 200: { description: 'Updated' }, 400: errorResponses[400], ...common },
  });
  r.registerPath({
    method: 'get',
    path: '/organizations/{organizationId}/subscription',
    tags: O,
    security,
    summary: 'Subscription and plan limits',
    request: { params: orgId },
    responses: { 200: { description: 'Subscription' }, ...common },
  });
  r.registerPath({
    method: 'post',
    path: '/organizations/{organizationId}/branches',
    tags: B,
    security,
    summary: 'Create a branch',
    description: 'Requires organization-wide `branch.create`. Limited by the plan (`PLAN_LIMIT_REACHED`).',
    request: { params: orgId, body: json(createBranchBody) },
    responses: { 201: { description: 'Created' }, 400: errorResponses[400], 409: errorResponses[409], ...common },
  });
  r.registerPath({
    method: 'get',
    path: '/organizations/{organizationId}/branches',
    tags: B,
    security,
    summary: 'List branches',
    description: 'Branch-scoped staff only see their own branches.',
    request: { params: orgId, query: listBranchesQuery },
    responses: { 200: { description: 'Page of branches' }, ...common },
  });
  r.registerPath({
    method: 'get',
    path: '/branches/{branchId}',
    tags: B,
    security,
    summary: 'Get a branch',
    request: { params: branchId },
    responses: { 200: { description: 'Branch' }, ...common },
  });
  r.registerPath({
    method: 'patch',
    path: '/branches/{branchId}',
    tags: B,
    security,
    summary: 'Update a branch',
    request: { params: branchId, body: json(updateBranchBody) },
    responses: { 200: { description: 'Updated' }, 400: errorResponses[400], ...common },
  });
  r.registerPath({
    method: 'get',
    path: '/branches/{branchId}/settings',
    tags: B,
    security,
    summary: 'Branch settings (tax, service charge, receipts)',
    request: { params: branchId },
    responses: { 200: { description: 'Settings; rates are decimal strings' }, ...common },
  });
  r.registerPath({
    method: 'put',
    path: '/branches/{branchId}/settings',
    tags: B,
    security,
    summary: 'Update branch settings',
    description: 'Requires `branch.settings.manage`.',
    request: { params: branchId, body: json(branchSettingsBody) },
    responses: { 200: { description: 'Updated' }, 400: errorResponses[400], ...common },
  });
  const F = ['Files'];
  const fileId = z.object({ fileId: z.uuid() });
  r.registerPath({
    method: 'post',
    path: '/files',
    tags: F,
    security,
    summary: 'Upload a file (multipart/form-data)',
    description:
      'Fields: `file` (binary) plus `organizationId`, `purpose` and optional `branchId`. The type is detected from the content: PNG, JPEG or WebP for MENU_IMAGE and BRANDING; also PDF for EXPENSE_ATTACHMENT and DOCUMENT. Size limit: UPLOAD_MAX_BYTES (default 5 MB). Permission depends on the purpose: catalog.manage, expense.create, organization.update / branch.settings.manage, organization.update / branch.update.',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: uploadFileBody.extend({ file: z.string().openapi({ type: 'string', format: 'binary' }) }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Stored file metadata' },
      400: errorResponses[400],
      413: { description: 'File too large' },
      415: { description: 'File type not allowed for this purpose' },
      ...common,
    },
  });
  r.registerPath({
    method: 'get',
    path: '/files',
    tags: F,
    security,
    summary: 'List files of an organization (paged)',
    description: 'Expense attachments are listed only for holders of expense.create or expense.approve.',
    request: { query: listFilesQuery },
    responses: { 200: { description: 'Page of files' }, ...common },
  });
  r.registerPath({
    method: 'get',
    path: '/files/{fileId}',
    tags: F,
    security,
    summary: 'File metadata',
    request: { params: fileId },
    responses: { 200: { description: 'File' }, ...common },
  });
  r.registerPath({
    method: 'get',
    path: '/files/{fileId}/content',
    tags: F,
    security,
    summary: 'Download the file bytes',
    request: { params: fileId },
    responses: { 200: { description: 'The file, with its stored Content-Type' }, ...common },
  });
  r.registerPath({
    method: 'delete',
    path: '/files/{fileId}',
    tags: F,
    security,
    summary: 'Delete a file',
    request: { params: fileId },
    responses: { 204: { description: 'Deleted' }, ...common },
  });
  return r;
}
