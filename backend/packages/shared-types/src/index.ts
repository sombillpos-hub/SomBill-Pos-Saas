/**
 * Types shared by every SomBill service and the API Gateway.
 * Keep this package dependency-free: it is imported by everything.
 */

// ---------------------------------------------------------------------------
// Permissions (permission-based authorization). Format: <resource>.<action>
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
  // Organization & branches
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
  BRANCH_CREATE: 'branch.create',
  BRANCH_READ: 'branch.read',
  BRANCH_UPDATE: 'branch.update',
  BRANCH_SETTINGS_MANAGE: 'branch.settings.manage',
  SUBSCRIPTION_READ: 'subscription.read',
  // Identity
  USER_READ: 'user.read',
  ROLE_READ: 'role.read',
  ROLE_ASSIGN: 'role.assign',
  AUDIT_READ: 'audit.read',
  // Restaurant operations (enforced by later phases' services)
  CATALOG_READ: 'catalog.read',
  CATALOG_MANAGE: 'catalog.manage',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_MANAGE: 'inventory.manage',
  PURCHASE_MANAGE: 'purchase.manage',
  TABLE_READ: 'table.read',
  TABLE_MANAGE: 'table.manage',
  ORDER_CREATE: 'order.create',
  ORDER_READ: 'order.read',
  ORDER_UPDATE: 'order.update',
  ORDER_CANCEL: 'order.cancel',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_READ: 'payment.read',
  REFUND_CREATE: 'refund.create',
  REFUND_APPROVE: 'refund.approve',
  CASH_SESSION_MANAGE: 'cash_session.manage',
  KITCHEN_READ: 'kitchen.read',
  KITCHEN_UPDATE: 'kitchen.update',
  // Workforce, finance, reporting
  EMPLOYEE_READ: 'employee.read',
  EMPLOYEE_MANAGE: 'employee.manage',
  ATTENDANCE_MANAGE: 'attendance.manage',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_APPROVE: 'expense.approve',
  ACCOUNTING_READ: 'accounting.read',
  ACCOUNTING_MANAGE: 'accounting.manage',
  REPORT_READ: 'report.read',
  NOTIFICATION_READ: 'notification.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

// ---------------------------------------------------------------------------
// System roles. Organizations may later add custom roles; system roles are global and immutable.
// ---------------------------------------------------------------------------
export const SYSTEM_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  WAITER: 'waiter',
  KITCHEN: 'kitchen',
  INVENTORY_CLERK: 'inventory_clerk',
  ACCOUNTANT: 'accountant',
  HR_MANAGER: 'hr_manager',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

const P = PERMISSIONS;

/** Default permissions of each system role. The identity service seeds these. */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS.filter((p) => p !== P.ORGANIZATION_UPDATE && p !== P.ACCOUNTING_MANAGE),
  cashier: [
    P.ORGANIZATION_READ,
    P.BRANCH_READ,
    P.CATALOG_READ,
    P.TABLE_READ,
    P.ORDER_CREATE,
    P.ORDER_READ,
    P.ORDER_UPDATE,
    P.PAYMENT_CREATE,
    P.PAYMENT_READ,
    P.REFUND_CREATE,
    P.CASH_SESSION_MANAGE,
    P.NOTIFICATION_READ,
  ],
  waiter: [
    P.ORGANIZATION_READ,
    P.BRANCH_READ,
    P.CATALOG_READ,
    P.TABLE_READ,
    P.ORDER_CREATE,
    P.ORDER_READ,
    P.ORDER_UPDATE,
    P.KITCHEN_READ,
    P.NOTIFICATION_READ,
  ],
  kitchen: [
    P.ORGANIZATION_READ,
    P.BRANCH_READ,
    P.CATALOG_READ,
    P.ORDER_READ,
    P.KITCHEN_READ,
    P.KITCHEN_UPDATE,
    P.NOTIFICATION_READ,
  ],
  inventory_clerk: [
    P.ORGANIZATION_READ,
    P.BRANCH_READ,
    P.CATALOG_READ,
    P.INVENTORY_READ,
    P.INVENTORY_MANAGE,
    P.PURCHASE_MANAGE,
    P.NOTIFICATION_READ,
  ],
  accountant: [
    P.ORGANIZATION_READ,
    P.BRANCH_READ,
    P.PAYMENT_READ,
    P.EXPENSE_CREATE,
    P.EXPENSE_APPROVE,
    P.ACCOUNTING_READ,
    P.ACCOUNTING_MANAGE,
    P.REPORT_READ,
    P.NOTIFICATION_READ,
  ],
  hr_manager: [
    P.ORGANIZATION_READ,
    P.BRANCH_READ,
    P.USER_READ,
    P.EMPLOYEE_READ,
    P.EMPLOYEE_MANAGE,
    P.ATTENDANCE_MANAGE,
    P.NOTIFICATION_READ,
  ],
};

// ---------------------------------------------------------------------------
// JWT access-token claims (signed by the identity service, RS256)
// ---------------------------------------------------------------------------
/** One role assignment. `branchId: null` means the role applies to every branch of the organization. */
export interface MembershipClaim {
  organizationId: string;
  branchId: string | null;
  role: string;
  permissions: Permission[];
}

export interface AccessTokenClaims {
  /** User id */
  sub: string;
  /** Session id (refresh-token family) */
  sid: string;
  email: string;
  memberships: MembershipClaim[];
}

/** The authenticated principal attached to each request after JWT verification. */
export interface Principal {
  userId: string;
  sessionId: string;
  email: string;
  memberships: MembershipClaim[];
}

// ---------------------------------------------------------------------------
// Standard API responses
// ---------------------------------------------------------------------------
export interface ApiSuccess<T> {
  data: T;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiPage<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}
