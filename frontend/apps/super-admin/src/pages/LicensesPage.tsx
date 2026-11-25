import { CalendarClock, ShieldCheck } from 'lucide-react';
import { Badge, Card, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { useQuery } from '@sombill/shared-hooks/useQuery';
import { formatDate } from '@sombill/shared-utils/format';
import { staffList } from '../services/hq';
import { useHq } from '../features/HqContext';
import type { LicenseStatus } from '@sombill/shared-types/types';

const STATUS: Record<LicenseStatus, { label: string; tone: 'green' | 'yellow' | 'red' | 'blue' }> = {
  active: { label: 'Active', tone: 'green' },
  trial: { label: 'Trial', tone: 'blue' },
  past_due: { label: 'Payment overdue', tone: 'yellow' },
  suspended: { label: 'Suspended', tone: 'red' },
};
const PLAN = { starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise' };

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  return (
    <div className="sa-gauge" role="img" aria-label={`${label}: ${used} of ${max}`}>
      <div className="sa-gauge-head">
        <span>{label}</span>
        <b>
          {used} of {max}
        </b>
      </div>
      <div className="sa-gauge-bar" data-warn={pct >= 90}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Plan, limits and usage. Plans are changed by SomBill, not here. */
export default function LicensesPage() {
  const { org, branches } = useHq();
  const staff = useQuery(() => staffList(branches.map((b) => b.id)), [branches.length]);
  const active = new Set((staff.data ?? []).filter((s) => s.status === 'active').map((s) => s.user_id)).size;
  const st = STATUS[org.license_status];
  const days = org.license_expires_at
    ? Math.ceil((new Date(org.license_expires_at).getTime() - Date.now()) / 86400000)
    : null;
  return (
    <div>
      <PageHeader
        eyebrow="Consolidated Finance · Plan"
        title="SaaS Subscription"
        description="Your SomBill plan, what it includes and how much of it you use."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Plan">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="sa-plan">
                <ShieldCheck className="h-5 w-5" aria-hidden /> {PLAN[org.plan]}
              </span>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarClock className="h-4 w-4" aria-hidden />
              {org.license_expires_at
                ? `Renews / expires ${formatDate(org.license_expires_at)}${days !== null ? (days >= 0 ? ` (${days} day${days === 1 ? '' : 's'} left)` : ' (expired)') : ''}`
                : 'No expiry date set'}
            </p>
            {org.license_status === 'suspended' && (
              <p role="alert" className="text-sm font-medium text-red-600">
                The subscription is suspended: new branches cannot be added.
              </p>
            )}
            {org.license_status === 'past_due' && (
              <p role="alert" className="text-sm font-medium text-amber-700">
                Payment is overdue. Contact your SomBill account manager to avoid suspension.
              </p>
            )}
          </div>
        </Card>
        <Card title="Usage">
          <div className="space-y-4">
            <Meter label="Branches" used={branches.length} max={org.max_branches} />
            <Meter label="Staff accounts" used={active} max={org.max_staff} />
            <p className="text-xs text-slate-500">
              Plan changes, invoices and payment are handled by SomBill. Contact your account manager to upgrade.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
