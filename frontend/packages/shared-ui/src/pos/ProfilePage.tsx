import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut } from 'lucide-react';
import { useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { nullIfEmpty, passwordSchema, PHONE_RE } from '@sombill/shared-types/schemas';
import { formatDateTime, ROLE_LABEL } from '@sombill/shared-utils/format';
import { Badge, Card, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input } from '@sombill/shared-ui/ui/Field';
import { ConfirmDialog } from '@sombill/shared-ui/ui/ConfirmDialog';
import { useToast } from '@sombill/shared-ui/ui/Toast';

/** Unsent drafts are device-local; discard them on logout. */
export function clearPosDrafts() {
  try {
    ['sombill.waiter.cart', 'sombill.cashier.sale'].forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  phone: z.string().refine((v) => v.trim() === '' || PHONE_RE.test(v.trim()), 'Enter a valid phone number'),
});
type ProfileForm = z.input<typeof profileSchema>;
type PasswordForm = z.input<typeof passwordSchema>;

export default function ProfilePage() {
  const r = useRestaurant();
  const { profile, membership, session, reload, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const pf = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' },
  });
  const pw = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const saveProfile = async (raw: ProfileForm) => {
    const v = profileSchema.parse(raw);
    try {
      unwrap(
        await supabase
          .from('profiles')
          .update({ full_name: v.full_name, phone: nullIfEmpty(v.phone) })
          .eq('id', session!.user.id)
          .select('id')
          .single(),
      );
      toast.success('Profile updated.');
      await reload();
      pf.reset(v);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };
  const savePassword = async (v: PasswordForm) => {
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success('Password changed.');
    pw.reset();
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="My Profile" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Employee">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Name</dt>
              <dd className="text-right font-semibold">{profile?.full_name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Email</dt>
              <dd className="truncate text-right">{profile?.email ?? session?.user.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-right">{profile?.phone || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Restaurant</dt>
              <dd className="text-right">{r.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Role</dt>
              <dd>{membership ? ROLE_LABEL[membership.role] : '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Account status</dt>
              <dd>
                <Badge tone={membership?.status === 'active' ? 'green' : 'red'}>
                  {membership?.status === 'active' ? 'Active' : 'Suspended'}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Member since</dt>
              <dd className="text-right">{membership ? formatDateTime(membership.created_at, r.timezone) : '—'}</dd>
            </div>
          </dl>
          <Button
            variant="danger"
            className="mt-6 h-12 w-full"
            icon={<LogOut className="h-5 w-5" />}
            onClick={() => setConfirmLogout(true)}
          >
            Log out
          </Button>
        </Card>
        <div className="space-y-6">
          <Card title="Edit details">
            <form onSubmit={pf.handleSubmit(saveProfile)} className="space-y-4" noValidate>
              <Input
                label="Full name"
                {...pf.register('full_name')}
                error={pf.formState.errors.full_name?.message}
                className="h-11"
              />
              <Input
                label="Phone"
                type="tel"
                {...pf.register('phone')}
                error={pf.formState.errors.phone?.message}
                className="h-11"
              />
              <p className="text-xs text-slate-500">Email, role and restaurant are managed by your manager.</p>
              <Button
                type="submit"
                className="h-11"
                loading={pf.formState.isSubmitting}
                disabled={!pf.formState.isDirty}
              >
                Save
              </Button>
            </form>
          </Card>
          <Card title="Change password">
            <form onSubmit={pw.handleSubmit(savePassword)} className="space-y-4" noValidate>
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                {...pw.register('password')}
                error={pw.formState.errors.password?.message}
                className="h-11"
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                {...pw.register('confirm')}
                error={pw.formState.errors.confirm?.message}
                className="h-11"
              />
              <Button type="submit" variant="navy" className="h-11" loading={pw.formState.isSubmitting}>
                Change password
              </Button>
            </form>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Any unsent draft order on this device will be discarded."
        confirmLabel="Log out"
        onConfirm={async () => {
          clearPosDrafts();
          await signOut();
          navigate('/login', { replace: true });
        }}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
