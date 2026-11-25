import { useMemo, useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, PageHeader, TableSkeleton } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { Input, Select } from '@sombill/shared-ui/ui/Field';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { friendlyError } from '@sombill/api-client/supabase';
import { formatDate } from '@sombill/shared-utils/format';
import type { AppRole } from '@sombill/shared-types/types';
import { staffAction, staffList } from '../services/hq';
import { useHq } from '../features/HqContext';
import type { StaffRow } from '../features/types';

const ROLES: AppRole[] = ['manager', 'cashier', 'waiter', 'kitchen'];
const ROLE_LABEL: Record<AppRole, string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  waiter: 'Waiter',
  kitchen: 'Kitchen',
};

/** Everyone who works in the group, with role changes, suspension, password reset and invitations. Runs through the same secure function the branch managers use. */
export default function UsersPage() {
  const { branches, scopeIds } = useHq();
  const toast = useToast();
  const q = useQuery(() => staffList(branches.map((b) => b.id)), [branches.length]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'all' | AppRole>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [invite, setInvite] = useState(false);
  const [form, setForm] = useState({
    restaurant_id: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'waiter' as AppRole,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ m: StaffRow; kind: 'suspend' | 'activate' | 'reset' } | null>(null);
  const branch = (id: string) => branches.find((b) => b.id === id)?.name ?? '—';

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? [])
      .filter((m) => scopeIds.includes(m.restaurant_id))
      .filter((m) => (role === 'all' || m.role === role) && (status === 'all' || m.status === status))
      .filter((m) => !s || m.full_name.toLowerCase().includes(s) || (m.email ?? '').toLowerCase().includes(s))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [q.data, scopeIds, search, role, status]);

  const changeRole = async (m: StaffRow, next: AppRole) => {
    try {
      await staffAction({ action: 'update_role', member_id: m.id, role: next });
      toast.success(`${m.full_name} is now ${ROLE_LABEL[next]} at ${branch(m.restaurant_id)}.`);
      await q.reload();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };
  const doConfirm = async () => {
    if (!confirm) return;
    const { m, kind } = confirm;
    try {
      if (kind === 'reset')
        await staffAction({
          action: 'reset_password',
          member_id: m.id,
          redirect_to: `${window.location.origin}/reset-password`,
        });
      else
        await staffAction({
          action: 'set_status',
          member_id: m.id,
          status: kind === 'suspend' ? 'suspended' : 'active',
        });
      toast.success(
        kind === 'reset'
          ? 'Password reset link sent.'
          : kind === 'suspend'
            ? `${m.full_name} suspended.`
            : `${m.full_name} reactivated.`,
      );
      setConfirm(null);
      await q.reload();
    } catch (e) {
      throw new Error(friendlyError(e));
    }
  };
  const send = async () => {
    setError(null);
    if (!form.restaurant_id) return setError('Choose a branch.');
    if (form.password && form.password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      await staffAction({
        action: 'create',
        restaurant_id: form.restaurant_id,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        phone: form.phone || undefined,
        password: form.password || undefined,
        redirect_to: `${window.location.origin}/reset-password`,
      });
      toast.success(
        form.password
          ? `${form.full_name} created with instant login credentials.`
          : `${form.full_name} added. An invitation email was sent if the account is new.`,
      );
      setInvite(false);
      setForm({ ...form, full_name: '', email: '', phone: '', password: '' });
      await q.reload();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Central Operations · Access Control"
        title="Global Staff & RBAC"
        description="Roles are per branch: a person can be a cashier in one branch and a manager in another."
        actions={
          <Button
            icon={<UserPlus className="h-4 w-4" />}
            onClick={() => {
              setError(null);
              setForm((f) => ({ ...f, restaurant_id: f.restaurant_id || branches[0]?.id || '' }));
              setInvite(true);
            }}
          >
            Add staff
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input h-10 w-64"
          type="search"
          placeholder="Search name or email"
          aria-label="Search staff"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input h-10 w-40"
          aria-label="Role filter"
          value={role}
          onChange={(e) => setRole(e.target.value as 'all' | AppRole)}
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          className="input h-10 w-40"
          aria-label="Status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'suspended')}
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <Card bodyClassName="p-0">
        {q.error ? (
          <ErrorState message={q.error} onRetry={q.reload} />
        ) : q.loading ? (
          <TableSkeleton cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No staff match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <p className="font-semibold">{m.full_name}</p>
                      <p className="text-xs text-slate-500">{m.email ?? m.phone ?? ''}</p>
                    </td>
                    <td>{branch(m.restaurant_id)}</td>
                    <td>
                      <select
                        className="input h-9 w-32"
                        aria-label={`Role of ${m.full_name} at ${branch(m.restaurant_id)}`}
                        value={m.role}
                        onChange={(e) => void changeRole(m, e.target.value as AppRole)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Badge tone={m.status === 'active' ? 'green' : 'red'}>
                        {m.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td>{m.last_login_at ? formatDate(m.last_login_at) : 'Never'}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirm({ m, kind: m.status === 'active' ? 'suspend' : 'activate' })}
                      >
                        {m.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>{' '}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<KeyRound className="h-3.5 w-3.5" />}
                        aria-label={`Send password reset to ${m.full_name}`}
                        onClick={() => setConfirm({ m, kind: 'reset' })}
                        disabled={!m.email}
                      >
                        Reset
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal
        open={invite}
        onClose={() => setInvite(false)}
        title="Add staff"
        description="New people get an email invitation; people who already have an account are linked to the branch."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInvite(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={send}>
              Add staff
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Branch"
            value={form.restaurant_id}
            onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          <Input
            label="Full name"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Password (optional)"
            type="password"
            placeholder="Min 6 chars for instant login"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="Set a password for instant sign-in, or leave blank to email an invite"
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </Modal>
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'reset'
            ? 'Send password reset?'
            : confirm?.kind === 'suspend'
              ? 'Suspend this person?'
              : 'Reactivate this person?'
        }
        message={
          confirm
            ? confirm.kind === 'reset'
              ? `A one-time reset link is emailed to ${confirm.m.email}. You never see the password.`
              : confirm.kind === 'suspend'
                ? `${confirm.m.full_name} will lose access to ${branch(confirm.m.restaurant_id)} immediately.`
                : `${confirm.m.full_name} will regain access to ${branch(confirm.m.restaurant_id)}.`
            : ''
        }
        confirmLabel={confirm?.kind === 'reset' ? 'Send link' : confirm?.kind === 'suspend' ? 'Suspend' : 'Reactivate'}
        danger={confirm?.kind === 'suspend'}
        onConfirm={doConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
