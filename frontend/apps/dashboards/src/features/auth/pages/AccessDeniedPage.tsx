import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { Button } from '@sombill/shared-ui/ui/Button';

const APP_FOR: Record<string, string> = {
  cashier: 'Cashier POS',
  kitchen: 'Kitchen display',
  waiter: 'Waiter POS',
  manager: 'Manager dashboard',
};

export function AccessDeniedPage({ reason }: { reason: 'wrong_app' | 'suspended' }) {
  const { signOut, membership } = useAuth();
  const role = membership?.role ?? 'staff';
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% -15%, rgba(220,38,38,0.12), transparent 70%), radial-gradient(ellipse 60% 45% at 88% 20%, rgba(249,115,22,0.09), transparent 65%), #fffaf9',
      }}
    >
      <div className="card relative max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#fbbf24]"
          aria-hidden
        />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-brand-red ring-1 ring-red-200/70">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          {reason === 'suspended' ? 'Account suspended' : 'Not available for your role'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {reason === 'suspended'
            ? 'Your staff account is suspended. Contact your restaurant manager.'
            : `Your account is set up as ${role}. Please use the ${APP_FOR[role] ?? 'app for your role'} instead.`}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" onClick={() => void signOut()}>
            Sign out
          </Button>
          <a href="/">
            <Button variant="secondary">Visit SomBill Website</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
