import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, KeyRound, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { useStaffDirectory, type StaffEntry } from '@sombill/shared-hooks/useStaffDirectory';
import { supabase } from '@sombill/api-client/supabase';
import { staffSchema, nullIfEmpty, type StaffForm } from '@sombill/shared-types/schemas';
import { fetchAudit } from '@sombill/api-client/queries';
import { formatDateTime, ROLE_LABEL } from '@sombill/shared-utils/format';
import type { AppRole } from '@sombill/shared-types/types';
import { Badge, Card, PageHeader, EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { DataTable, type Column } from '@sombill/shared-ui/ui/DataTable';
import { SearchInput } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input, Select } from '@sombill/shared-ui/ui/Field';
import { Modal } from '@sombill/shared-ui/ui/Modal';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { IconBtn } from '@sombill/manager/pages/menu/ProductsPage';
import { describeAudit } from '@sombill/manager/pages/dashboard/DashboardPage';

/** Calls the manage-staff Edge Function. The service-role key lives only on the server. */
export async function staffAction(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = (await ctx.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* keep generic */
      }
    }
    throw new Error(msg);
  }
  return data;
}

export default function StaffPage() {
  const r = useRestaurant();
  const { session } = useAuth();
  const toast = useToast();
  const staff = useStaffDirectory(r.id);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | AppRole>('');
  const [creating, setCreating] = useState(false);
  const [activityFor, setActivityFor] = useState<StaffEntry | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'suspend' | 'activate' | 'reset'; m: StaffEntry } | null>(null);
  const me = session?.user.id;

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (staff.data ?? [])
      .filter(
        (m) =>
          (!roleFilter || m.role === roleFilter) &&
          (!t || [m.profile?.full_name, m.profile?.email, m.profile?.phone].some((v) => v?.toLowerCase().includes(t))),
      )
      .sort((a, b) =>
        a.status === b.status
          ? (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '')
          : a.status === 'active'
            ? -1
            : 1,
      );
  }, [staff.data, search, roleFilter]);

  const changeRole = async (m: StaffEntry, role: AppRole) => {
    try {
      await staffAction({ action: 'update_role', member_id: m.id, role });
      toast.success(`${m.profile?.full_name ?? 'Staff member'} is now ${ROLE_LABEL[role].toLowerCase()}.`);
      await staff.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const runConfirm = async (reason: string) => {
    if (!confirm) return;
    const { kind, m } = confirm;
    if (kind === 'reset') {
      await staffAction({
        action: 'reset_password',
        member_id: m.id,
        redirect_to: `${window.location.origin}/reset-password`,
      });
      toast.success(`Password reset email sent to ${m.profile?.email}.`);
    } else {
      await staffAction({
        action: 'set_status',
        member_id: m.id,
        status: kind === 'suspend' ? 'suspended' : 'active',
        reason,
      });
      toast.success(`${m.profile?.full_name} ${kind === 'suspend' ? 'suspended' : 'reactivated'}.`);
    }
    setConfirm(null);
    await staff.reload();
  };

  const columns: Column<StaffEntry>[] = [
    {
      key: 'name',
      header: 'Employee',
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-semibold">
            {m.profile?.full_name || '—'} {m.user_id === me && <Badge tone="blue">You</Badge>}
          </p>
          <p className="truncate text-xs text-slate-500">
            {m.profile?.email}
            {m.profile?.phone ? ` · ${m.profile.phone}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => (
        <select
          className="input h-8 w-32 py-0 text-xs"
          aria-label={`Role for ${m.profile?.full_name}`}
          value={m.role}
          disabled={m.user_id === me}
          onChange={(e) => void changeRole(m, e.target.value as AppRole)}
        >
          {(Object.keys(ROLE_LABEL) as AppRole[]).map((k) => (
            <option key={k} value={k}>
              {ROLE_LABEL[k]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'status',
      header: 'Account',
      cell: (m) => (
        <Badge tone={m.status === 'active' ? 'green' : 'red'}>{m.status === 'active' ? 'Active' : 'Suspended'}</Badge>
      ),
    },
    {
      key: 'login',
      header: 'Last login',
      cell: (m) => (
        <span className="whitespace-nowrap text-slate-600">
          {m.profile?.last_login_at ? formatDateTime(m.profile.last_login_at, r.timezone) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="flex justify-end gap-1">
          <IconBtn label="Activity" onClick={() => setActivityFor(m)}>
            <Activity className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Send password reset" onClick={() => setConfirm({ kind: 'reset', m })}>
            <KeyRound className="h-4 w-4" />
          </IconBtn>
          {m.user_id !== me &&
            (m.status === 'active' ? (
              <IconBtn label="Suspend" onClick={() => setConfirm({ kind: 'suspend', m })}>
                <UserX className="h-4 w-4" />
              </IconBtn>
            ) : (
              <IconBtn label="Reactivate" onClick={() => setConfirm({ kind: 'activate', m })}>
                <UserCheck className="h-4 w-4" />
              </IconBtn>
            ))}
        </div>
      ),
    },
  ];

  const p = r.settings.permissions;
  return (
    <div>
      <PageHeader
        eyebrow="People · Team & Permissions"
        title="Staff Management"
        description="Invite employees, assign roles and control access. Passwords are set by employees themselves — never visible to managers."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Add staff
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <Card bodyClassName="p-0" className="xl:col-span-3">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, email or phone"
              className="sm:w-80"
            />
            <select
              className="input sm:w-44"
              aria-label="Role filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AppRole | '')}
            >
              <option value="">All roles</option>
              {(Object.keys(ROLE_LABEL) as AppRole[]).map((k) => (
                <option key={k} value={k}>
                  {ROLE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            loading={staff.loading && !staff.data}
            error={staff.error}
            onRetry={staff.reload}
            empty={
              <EmptyState
                title="No staff found"
                action={
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                    Add staff
                  </Button>
                }
              />
            }
          />
        </Card>
        <Card title="Role permissions" action={<ShieldCheck className="h-4 w-4 text-slate-400" />}>
          <ul className="space-y-3 text-sm">
            <li>
              <b>Manager</b>
              <p className="text-slate-500">
                Full access to this dashboard, menu, stock, purchasing, expenses, reports and staff.
              </p>
            </li>
            <li>
              <b>Cashier</b>
              <p className="text-slate-500">
                Takes payments in Cashier POS.{p.cashier_can_refund ? ' Can refund.' : ''}
                {p.cashier_can_cancel_orders ? ' Can cancel orders.' : ''}
                {p.cashier_can_create_customers ? ' Can add customers.' : ''}
              </p>
            </li>
            <li>
              <b>Waiter</b>
              <p className="text-slate-500">
                Creates orders and adds items to their own unpaid orders in Waiter POS, marks Ready orders served,
                requests bills.{p.waiter_can_create_customers ? ' Can add customers.' : ''}
                {p.waiter_can_edit_others_orders ? ' Can work on colleagues\u2019 orders.' : ''}
              </p>
            </li>
            <li>
              <b>Kitchen</b>
              <p className="text-slate-500">
                Moves orders through Accepted, Preparing and Ready. Cannot create orders or change items.
              </p>
            </li>
          </ul>
          <Link
            to="/settings?tab=permissions"
            className="mt-4 inline-block text-sm font-semibold text-brand-red hover:underline"
          >
            Edit permissions
          </Link>
        </Card>
      </div>

      {creating && (
        <CreateStaffModal
          restaurantId={r.id}
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await staff.reload();
          }}
        />
      )}
      {activityFor && <ActivityModal member={activityFor} onClose={() => setActivityFor(null)} />}
      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.kind === 'suspend'}
        requireReason={confirm?.kind === 'suspend'}
        title={
          confirm?.kind === 'reset'
            ? 'Send password reset?'
            : confirm?.kind === 'suspend'
              ? `Suspend ${confirm?.m.profile?.full_name}?`
              : `Reactivate ${confirm?.m.profile?.full_name}?`
        }
        message={
          confirm?.kind === 'reset'
            ? `A secure reset link will be emailed to ${confirm.m.profile?.email}. You will not see the new password.`
            : confirm?.kind === 'suspend'
              ? 'They will immediately lose access to all SomBill apps for this restaurant.'
              : 'They will regain access with their current role.'
        }
        confirmLabel={confirm?.kind === 'reset' ? 'Send email' : confirm?.kind === 'suspend' ? 'Suspend' : 'Reactivate'}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function CreateStaffModal({
  restaurantId,
  onClose,
  onDone,
}: {
  restaurantId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { full_name: '', email: '', phone: '', role: 'waiter' },
  });
  const submit = async (raw: StaffForm) => {
    const v = staffSchema.parse(raw);
    setServerError(null);
    if (password && password.length < 6) {
      setServerError('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = (await staffAction({
        action: 'create',
        restaurant_id: restaurantId,
        full_name: v.full_name,
        email: v.email.toLowerCase(),
        phone: nullIfEmpty(v.phone),
        ...(password ? { password } : {}),
        role: v.role,
        redirect_to: `${window.location.origin}/reset-password`,
      })) as { invited?: boolean; created_with_password?: boolean };
      toast.success(
        res?.created_with_password
          ? `${v.full_name} created with instant login credentials.`
          : res?.invited
            ? `Invitation emailed to ${v.email}.`
            : `${v.full_name} added to your restaurant.`,
      );
      await onDone();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Add staff member"
      description="New employees receive an email invitation to set their own password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={isSubmitting}>
            Send invitation
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="Full name"
          {...register('full_name')}
          error={errors.full_name?.message}
          required
          wrapClassName="sm:col-span-2"
        />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} required />
        <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} placeholder="+252 63 …" />
        <Select label="Role" {...register('role')}>
          <option value="waiter">Waiter</option>
          <option value="cashier">Cashier</option>
          <option value="kitchen">Kitchen</option>
          <option value="manager">Manager</option>
        </Select>
        <Input
          label="Initial password (optional)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 6 chars (instant login)"
          hint="Leave blank to email an invite"
        />
        {serverError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}

function ActivityModal({ member, onClose }: { member: StaffEntry; onClose: () => void }) {
  const r = useRestaurant();
  const q = useQuery(async () => {
    const [audit, orders, payments] = await Promise.all([
      fetchAudit(r.id, { limit: 300 }).then((a) => a.filter((x) => x.actor_id === member.user_id).slice(0, 40)),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', r.id)
        .eq('waiter_id', member.user_id),
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', r.id)
        .eq('cashier_id', member.user_id),
    ]);
    return { audit, orders: orders.count ?? 0, payments: payments.count ?? 0 };
  }, [member.user_id]);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Activity · ${member.profile?.full_name ?? ''}`}
      description={`Member since ${formatDateTime(member.created_at, r.timezone)}`}
    >
      {q.loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-red-600">{q.error}</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xl font-bold text-brand-navy">{q.data?.orders}</p>
              <p className="text-xs text-slate-500">Orders as waiter</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xl font-bold text-brand-navy">{q.data?.payments}</p>
              <p className="text-xs text-slate-500">Payments handled</p>
            </div>
          </div>
          {!q.data?.audit.length ? (
            <EmptyState title="No recorded actions yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {q.data.audit.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <span className="text-slate-700">{describeAudit(a.action, a.entity_type)}</span>
                  <span className="ml-2 text-xs text-slate-400">{formatDateTime(a.created_at, r.timezone)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
