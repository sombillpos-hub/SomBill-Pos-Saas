import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStaffAction, HttpError, type Member, type StaffBackend } from '../../functions/manage-staff/handler.js';

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '99999999-9999-4999-8999-999999999999';
const MGR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MGR2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WAITER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OWNER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function backend(members: Member[], users: Record<string, string> = {}, owners: Record<string, string[]> = {}) {
  const audit: unknown[] = [];
  const db: StaffBackend & {
    audit: ReturnType<typeof vi.fn>;
    inviteUser: ReturnType<typeof vi.fn>;
    sendPasswordReset: ReturnType<typeof vi.fn>;
  } = {
    findMembership: async (rid, uid) => members.find((m) => m.restaurant_id === rid && m.user_id === uid) ?? null,
    isOrgOwner: async (rid, uid) => (owners[uid] ?? []).includes(rid),
    getMember: async (id) => members.find((m) => m.id === id) ?? null,
    countActiveManagers: async (rid) =>
      members.filter((m) => m.restaurant_id === rid && m.role === 'manager' && m.status === 'active').length,
    findUserIdByEmail: async (email) => Object.entries(users).find(([, e]) => e === email)?.[0] ?? null,
    inviteUser: vi.fn(async () => 'new-user-id'),
    upsertProfile: async () => undefined,
    insertMember: async (m) => {
      const row = { id: `m${members.length + 1}`, ...m };
      members.push(row);
      return row;
    },
    updateMember: async (id, patch) => {
      const m = members.find((x) => x.id === id)!;
      Object.assign(m, patch);
      return m;
    },
    getUserEmail: async (uid) => users[uid] ?? null,
    sendPasswordReset: vi.fn(async () => undefined),
    audit: vi.fn(async (e) => {
      audit.push(e);
    }),
  };
  return db;
}

const base = (): Member[] => [
  { id: 'd0000000-0000-4000-8000-000000000001', restaurant_id: R1, user_id: MGR, role: 'manager', status: 'active' },
  { id: 'd0000000-0000-4000-8000-000000000002', restaurant_id: R1, user_id: WAITER, role: 'waiter', status: 'active' },
  { id: 'd0000000-0000-4000-8000-000000000003', restaurant_id: R2, user_id: MGR2, role: 'manager', status: 'active' },
];
const expectHttp = async (p: Promise<unknown>, status: number, msg?: RegExp) => {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((e: HttpError) => {
    expect(e.status).toBe(status);
    if (msg) expect(e.message).toMatch(msg);
  });
};

describe('manage-staff edge function', () => {
  let members: Member[];
  beforeEach(() => {
    members = base();
  });

  it('rejects unauthenticated callers', async () => {
    await expectHttp(handleStaffAction(backend(members), null, { action: 'create' }), 401);
  });
  it('lets the group owner manage staff in any branch of the group, and only those', async () => {
    const owners = { [OWNER]: [R1] };
    const body = { action: 'create', restaurant_id: R1, email: 'x@y.com', full_name: 'New Person', role: 'waiter' };
    const res = await handleStaffAction(backend(members, {}, owners), OWNER, body);
    expect(res.status).toBeLessThan(300);
    await expectHttp(handleStaffAction(backend(members, {}, owners), OWNER, { ...body, restaurant_id: R2 }), 403);
  });
  it('rejects non-managers and managers of other restaurants', async () => {
    const body = { action: 'create', restaurant_id: R1, email: 'x@y.com', full_name: 'New Person', role: 'waiter' };
    await expectHttp(handleStaffAction(backend(members), WAITER, body), 403);
    await expectHttp(handleStaffAction(backend(members), MGR2, body), 403);
    await expectHttp(
      handleStaffAction(backend(members), MGR2, {
        action: 'set_status',
        member_id: 'd0000000-0000-4000-8000-000000000002',
        status: 'suspended',
      }),
      403,
    );
  });
  it('validates input', async () => {
    const db = backend(members);
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'create',
        restaurant_id: 'nope',
        email: 'a@b.co',
        full_name: 'Ab',
        role: 'waiter',
      }),
      400,
      /restaurant_id/,
    );
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'create',
        restaurant_id: R1,
        email: 'bad',
        full_name: 'Ab',
        role: 'waiter',
      }),
      400,
      /Email/,
    );
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'create',
        restaurant_id: R1,
        email: 'a@b.co',
        full_name: 'Ab',
        role: 'chef',
      }),
      400,
      /Role/,
    );
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'create',
        restaurant_id: R1,
        email: 'a@b.co',
        full_name: 'Ab',
        role: 'waiter',
        phone: 'abc',
      }),
      400,
      /Phone/,
    );
    await expectHttp(handleStaffAction(db, MGR, { action: 'explode' }), 400, /Unknown/);
  });
  it('invites a new employee without handling any password', async () => {
    const db = backend(members);
    const res = await handleStaffAction(
      db,
      MGR,
      {
        action: 'create',
        restaurant_id: R1,
        email: 'New@Staff.com',
        full_name: 'Nimco Cashier',
        role: 'cashier',
        redirect_to: 'https://evil.example/steal',
      },
      ['https://manager.sombill.com'],
    );
    expect(res.status).toBe(201);
    expect(db.inviteUser).toHaveBeenCalledWith('new@staff.com', { full_name: 'Nimco Cashier', phone: null }, undefined);
    expect(JSON.stringify(db.inviteUser.mock.calls)).not.toMatch(/password/i);
    expect(members.at(-1)).toMatchObject({
      restaurant_id: R1,
      user_id: 'new-user-id',
      role: 'cashier',
      status: 'active',
    });
    expect(db.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'staff_create', actor_id: MGR }));
  });
  it('only allows redirects to configured origins', async () => {
    const db = backend(members);
    await handleStaffAction(
      db,
      MGR,
      {
        action: 'create',
        restaurant_id: R1,
        email: 'a@b.co',
        full_name: 'Abdi',
        role: 'waiter',
        redirect_to: 'https://manager.sombill.com/reset-password',
      },
      ['https://manager.sombill.com'],
    );
    expect(db.inviteUser.mock.calls[0]![2]).toBe('https://manager.sombill.com/reset-password');
  });
  it('links an existing account and blocks duplicates', async () => {
    const db = backend(members, { [WAITER]: 'waiter@r1.test', 'u-existing': 'exists@r.test' });
    const res = await handleStaffAction(db, MGR, {
      action: 'create',
      restaurant_id: R1,
      email: 'exists@r.test',
      full_name: 'Existing',
      role: 'waiter',
    });
    expect((res.data as { invited: boolean }).invited).toBe(false);
    expect(db.inviteUser).not.toHaveBeenCalled();
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'create',
        restaurant_id: R1,
        email: 'waiter@r1.test',
        full_name: 'Dup',
        role: 'waiter',
      }),
      409,
    );
  });
  it('changes roles and suspends with audit', async () => {
    const db = backend(members);
    await handleStaffAction(db, MGR, {
      action: 'update_role',
      member_id: 'd0000000-0000-4000-8000-000000000002',
      role: 'cashier',
    });
    expect(members[1]!.role).toBe('cashier');
    await handleStaffAction(db, MGR, {
      action: 'set_status',
      member_id: 'd0000000-0000-4000-8000-000000000002',
      status: 'suspended',
      reason: 'Left the job',
    });
    expect(members[1]!.status).toBe('suspended');
    expect(db.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'staff_suspended', reason: 'Left the job' }),
    );
  });
  it('prevents self-demotion and removing the last manager', async () => {
    const db = backend(members);
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'update_role',
        member_id: 'd0000000-0000-4000-8000-000000000001',
        role: 'waiter',
      }),
      400,
      /your own/,
    );
    members.push({
      id: 'd0000000-0000-4000-8000-00000000000b',
      restaurant_id: R1,
      user_id: 'other-mgr',
      role: 'manager',
      status: 'active',
    });
    members[0]!.status = 'suspended'; // only m-mgr-b active now, but caller must be active manager
    await expectHttp(
      handleStaffAction(db, MGR, {
        action: 'set_status',
        member_id: 'd0000000-0000-4000-8000-00000000000b',
        status: 'suspended',
      }),
      403,
    );
    members[0]!.status = 'active';
    await handleStaffAction(db, MGR, {
      action: 'set_status',
      member_id: 'd0000000-0000-4000-8000-00000000000b',
      status: 'suspended',
    });
    expect(members.find((m) => m.id === 'd0000000-0000-4000-8000-00000000000b')!.status).toBe('suspended');
  });
  it('sends password reset emails without exposing passwords', async () => {
    const db = backend(members, { [WAITER]: 'waiter@r1.test' });
    const res = await handleStaffAction(db, MGR, {
      action: 'reset_password',
      member_id: 'd0000000-0000-4000-8000-000000000002',
    });
    expect(res.data).toEqual({ sent: true });
    expect(db.sendPasswordReset).toHaveBeenCalledWith('waiter@r1.test', undefined);
    await expectHttp(
      handleStaffAction(db, MGR2, { action: 'reset_password', member_id: 'd0000000-0000-4000-8000-000000000002' }),
      403,
    );
  });
});
