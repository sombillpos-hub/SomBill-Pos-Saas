// SomBill – staff provisioning logic (runtime-agnostic, unit-tested).
// The Deno entrypoint (index.ts) injects a service-role backed implementation
// of StaffBackend. The service-role key never leaves the server.

export type Role = 'manager' | 'cashier' | 'waiter' | 'kitchen';
export type MemberStatus = 'active' | 'suspended';

export interface Member {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: Role;
  status: MemberStatus;
}

export interface StaffBackend {
  findMembership(restaurantId: string, userId: string): Promise<Member | null>;
  /** True when the user owns the organization (group) that the restaurant belongs to. Owners manage every branch. */
  isOrgOwner?(restaurantId: string, userId: string): Promise<boolean>;
  getMember(memberId: string): Promise<Member | null>;
  countActiveManagers(restaurantId: string): Promise<number>;
  findUserIdByEmail(email: string): Promise<string | null>;
  inviteUser(email: string, meta: { full_name: string; phone: string | null }, redirectTo?: string): Promise<string>;
  upsertProfile(userId: string, patch: { full_name: string; phone: string | null; email: string }): Promise<void>;
  insertMember(m: Omit<Member, 'id'>): Promise<Member>;
  updateMember(memberId: string, patch: Partial<Pick<Member, 'role' | 'status'>>): Promise<Member>;
  getUserEmail(userId: string): Promise<string | null>;
  sendPasswordReset(email: string, redirectTo?: string): Promise<void>;
  audit(entry: {
    restaurant_id: string;
    actor_id: string;
    action: string;
    entity_id: string | null;
    old_data: unknown;
    new_data: unknown;
    reason?: string;
  }): Promise<void>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const ROLES: Role[] = ['manager', 'cashier', 'waiter', 'kitchen'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;

function str(v: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): string | null {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return null;
    throw new HttpError(400, `${field} is required`);
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be text`);
  const t = v.trim();
  if (opts.min !== undefined && t.length < opts.min) throw new HttpError(400, `${field} is too short`);
  if (opts.max !== undefined && t.length > opts.max) throw new HttpError(400, `${field} is too long`);
  return t;
}

function uuid(v: unknown, field: string): string {
  const s = str(v, field) as string;
  if (!UUID_RE.test(s)) throw new HttpError(400, `${field} is invalid`);
  return s;
}

function safeRedirect(v: unknown, allowedOrigins: string[]): string | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  try {
    const u = new URL(v);
    return allowedOrigins.includes(u.origin) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function requireManager(db: StaffBackend, restaurantId: string, callerId: string): Promise<void> {
  const m = await db.findMembership(restaurantId, callerId);
  if (m && m.status === 'active' && m.role === 'manager') return;
  if (db.isOrgOwner && (await db.isOrgOwner(restaurantId, callerId))) return;
  throw new HttpError(403, 'Only active managers or the group owner can manage staff');
}

export async function handleStaffAction(
  db: StaffBackend,
  callerId: string | null,
  body: unknown,
  allowedOrigins: string[] = [],
): Promise<{ status: number; data: unknown }> {
  if (!callerId) throw new HttpError(401, 'Not authenticated');
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Invalid request body');
  const b = body as Record<string, unknown>;
  const action = b.action;

  switch (action) {
    case 'create': {
      const restaurantId = uuid(b.restaurant_id, 'restaurant_id');
      await requireManager(db, restaurantId, callerId);
      const email = (str(b.email, 'Email', { max: 254 }) as string).toLowerCase();
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email is invalid');
      const fullName = str(b.full_name, 'Full name', { min: 2, max: 120 }) as string;
      const phone = str(b.phone, 'Phone', { optional: true, max: 20 });
      if (phone && !PHONE_RE.test(phone)) throw new HttpError(400, 'Phone is invalid');
      const role = b.role as Role;
      if (!ROLES.includes(role)) throw new HttpError(400, 'Role is invalid');

      let userId = await db.findUserIdByEmail(email);
      let invited = false;
      if (userId) {
        const existing = await db.findMembership(restaurantId, userId);
        if (existing) throw new HttpError(409, 'This person is already a staff member of this restaurant');
      } else {
        userId = await db.inviteUser(
          email,
          { full_name: fullName, phone },
          safeRedirect(b.redirect_to, allowedOrigins),
        );
        invited = true;
      }
      await db.upsertProfile(userId, { full_name: fullName, phone, email });
      const member = await db.insertMember({ restaurant_id: restaurantId, user_id: userId, role, status: 'active' });
      await db.audit({
        restaurant_id: restaurantId,
        actor_id: callerId,
        action: 'staff_create',
        entity_id: member.id,
        old_data: null,
        new_data: { email, role, invited },
      });
      return { status: 201, data: { member, invited } };
    }

    case 'update_role':
    case 'set_status': {
      const memberId = uuid(b.member_id, 'member_id');
      const target = await db.getMember(memberId);
      if (!target) throw new HttpError(404, 'Staff member not found');
      await requireManager(db, target.restaurant_id, callerId);

      const patch: Partial<Pick<Member, 'role' | 'status'>> = {};
      if (action === 'update_role') {
        const role = b.role as Role;
        if (!ROLES.includes(role)) throw new HttpError(400, 'Role is invalid');
        patch.role = role;
      } else {
        const status = b.status as MemberStatus;
        if (status !== 'active' && status !== 'suspended') throw new HttpError(400, 'Status is invalid');
        patch.status = status;
      }

      const losesManager =
        target.role === 'manager' &&
        target.status === 'active' &&
        ((patch.role && patch.role !== 'manager') || patch.status === 'suspended');
      if (losesManager) {
        if (target.user_id === callerId) {
          throw new HttpError(400, 'You cannot demote or suspend your own manager account');
        }
        if ((await db.countActiveManagers(target.restaurant_id)) <= 1) {
          throw new HttpError(400, 'The restaurant must keep at least one active manager');
        }
      }
      const updated = await db.updateMember(memberId, patch);
      await db.audit({
        restaurant_id: target.restaurant_id,
        actor_id: callerId,
        action: action === 'update_role' ? 'staff_role_change' : `staff_${patch.status}`,
        entity_id: memberId,
        old_data: { role: target.role, status: target.status },
        new_data: patch,
        reason: typeof b.reason === 'string' ? b.reason.slice(0, 500) : undefined,
      });
      return { status: 200, data: { member: updated } };
    }

    case 'reset_password': {
      const memberId = uuid(b.member_id, 'member_id');
      const target = await db.getMember(memberId);
      if (!target) throw new HttpError(404, 'Staff member not found');
      await requireManager(db, target.restaurant_id, callerId);
      const email = await db.getUserEmail(target.user_id);
      if (!email) throw new HttpError(400, 'This account has no email address');
      // Supabase emails a one-time reset link to the employee. The manager
      // never sees or sets the password.
      await db.sendPasswordReset(email, safeRedirect(b.redirect_to, allowedOrigins));
      await db.audit({
        restaurant_id: target.restaurant_id,
        actor_id: callerId,
        action: 'staff_password_reset',
        entity_id: memberId,
        old_data: null,
        new_data: { email_sent_to: email },
      });
      return { status: 200, data: { sent: true } };
    }

    default:
      throw new HttpError(400, 'Unknown action');
  }
}
