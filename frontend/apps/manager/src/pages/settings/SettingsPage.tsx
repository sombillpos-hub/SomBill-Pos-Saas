import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HQ_HOME, useAuth, useRestaurant } from '@sombill/shared-hooks/AuthContext';
import { supabase, unwrap, friendlyError } from '@sombill/api-client/supabase';
import { nullIfEmpty, restaurantSchema, type RestaurantForm } from '@sombill/shared-types/schemas';
import type { Json, RestaurantSettings } from '@sombill/shared-types/types';
import { Card, PageHeader } from '@sombill/shared-ui/ui/Feedback';
import { Tabs } from '@sombill/shared-ui/ui/Filters';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@sombill/shared-ui/ui/Field';
import { ImageUpload } from '@sombill/manager/components/ImageUpload';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { createOrganization } from '@sombill/api-client/organization';

type Tab = 'restaurant' | 'tax' | 'operations' | 'permissions' | 'group';
const TIMEZONES = [
  'Africa/Mogadishu',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  'Africa/Djibouti',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Europe/London',
  'UTC',
];
const CURRENCIES = [
  ['USD', 'US Dollar'],
  ['SLS', 'Somaliland Shilling'],
  ['SOS', 'Somali Shilling'],
  ['ETB', 'Ethiopian Birr'],
  ['KES', 'Kenyan Shilling'],
  ['DJF', 'Djiboutian Franc'],
  ['AED', 'UAE Dirham'],
  ['EUR', 'Euro'],
  ['GBP', 'Pound Sterling'],
];

export default function SettingsPage() {
  const r = useRestaurant();
  const { reload, isOwner, organization } = useAuth();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'restaurant';
  const [logo, setLogo] = useState<string | null>(r.logo_url);
  const [settings, setSettings] = useState<RestaurantSettings>(r.settings);
  const [savingOps, setSavingOps] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RestaurantForm>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: r.name,
      address: r.address ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      currency: r.currency,
      timezone: r.timezone,
      tax_rate_percent: Math.round(r.tax_rate * 10000) / 100,
      tax_inclusive: r.tax_inclusive,
      tax_label: r.tax_label,
      receipt_header: r.receipt_header ?? '',
      receipt_footer: r.receipt_footer ?? '',
    },
  });

  const saveProfile = async (raw: RestaurantForm) => {
    const v = restaurantSchema.parse(raw);
    setServerError(null);
    try {
      unwrap(
        await supabase
          .from('restaurants')
          .update({
            name: v.name,
            address: nullIfEmpty(v.address),
            phone: nullIfEmpty(v.phone),
            email: nullIfEmpty(v.email),
            currency: v.currency,
            timezone: v.timezone,
            tax_rate: Math.round(v.tax_rate_percent * 100) / 10000,
            tax_inclusive: v.tax_inclusive,
            tax_label: v.tax_label,
            receipt_header: nullIfEmpty(v.receipt_header),
            receipt_footer: nullIfEmpty(v.receipt_footer),
            logo_url: logo,
          })
          .eq('id', r.id)
          .select('id')
          .single(),
      );
      toast.success('Restaurant settings saved.');
      await reload();
    } catch (e) {
      setServerError(friendlyError(e));
    }
  };

  const saveSettings = async () => {
    setSavingOps(true);
    try {
      unwrap(
        await supabase
          .from('restaurants')
          .update({ settings: settings as unknown as Json })
          .eq('id', r.id)
          .select('id')
          .single(),
      );
      toast.success('Settings saved. POS apps pick them up on next refresh.');
      await reload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSavingOps(false);
    }
  };

  const set = <K extends keyof RestaurantSettings>(k: K, patch: Partial<RestaurantSettings[K]>) =>
    setSettings((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  const toggle = (k: keyof RestaurantSettings, field: string, label: string, description: string) => (
    <Checkbox
      key={`${k}.${field}`}
      name={`${k}.${field}`}
      label={label}
      description={description}
      checked={Boolean((settings[k] as unknown as Record<string, unknown>)[field])}
      onChange={(e) => set(k, { [field]: e.target.checked } as Partial<RestaurantSettings[typeof k]>)}
    />
  );

  return (
    <div>
      <PageHeader
        eyebrow="System · Branch Configuration"
        title="Settings"
        description="Restaurant profile, tax, receipts and operating rules. Changes are enforced by the database for every app."
      />
      <Tabs
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { id: 'restaurant', label: 'Restaurant' },
          { id: 'tax', label: 'Tax & receipts' },
          { id: 'operations', label: 'Tables, orders & stock' },
          { id: 'permissions', label: 'Staff permissions' },
          { id: 'group', label: 'Group HQ' },
        ]}
      />
      <div className="mt-6 max-w-4xl">
        {(tab === 'restaurant' || tab === 'tax') && (
          <form onSubmit={handleSubmit(saveProfile)} noValidate>
            {tab === 'restaurant' ? (
              <Card title="Restaurant profile">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Restaurant name"
                    {...register('name')}
                    error={errors.name?.message}
                    required
                    wrapClassName="md:col-span-2"
                  />
                  <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />
                  <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
                  <Input
                    label="Address"
                    {...register('address')}
                    error={errors.address?.message}
                    wrapClassName="md:col-span-2"
                  />
                  <Select
                    label="Currency"
                    {...register('currency')}
                    error={errors.currency?.message}
                    hint="Used for every amount shown in all SomBill apps"
                  >
                    {CURRENCIES.map(([c, n]) => (
                      <option key={c} value={c}>
                        {c} — {n}
                      </option>
                    ))}
                    {!CURRENCIES.some(([c]) => c === r.currency) && <option value={r.currency}>{r.currency}</option>}
                  </Select>
                  <Select
                    label="Time zone"
                    {...register('timezone')}
                    error={errors.timezone?.message}
                    hint="Defines business days for reports. Hargeisa uses Africa/Mogadishu (EAT, UTC+3)."
                  >
                    {[...new Set([r.timezone, ...TIMEZONES])].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <ImageUpload
                    value={logo}
                    onChange={setLogo}
                    restaurantId={r.id}
                    bucket="branding"
                    folder="logo"
                    label="Restaurant logo"
                  />
                </div>
              </Card>
            ) : (
              <Card title="Tax & receipt">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Input label="Tax label" {...register('tax_label')} error={errors.tax_label?.message} />
                  <Input
                    label="Tax rate (%)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    {...register('tax_rate_percent')}
                    error={errors.tax_rate_percent?.message}
                    hint="Applied to new orders"
                  />
                  <div className="md:pt-5">
                    <Checkbox label="Prices include tax" {...register('tax_inclusive')} />
                  </div>
                  <Textarea
                    label="Receipt header"
                    {...register('receipt_header')}
                    error={errors.receipt_header?.message}
                    wrapClassName="md:col-span-3"
                    hint="e.g. business licence number"
                  />
                  <Textarea
                    label="Receipt footer"
                    {...register('receipt_footer')}
                    error={errors.receipt_footer?.message}
                    wrapClassName="md:col-span-3"
                  />
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Each order stores the tax rate in force when it was created, so changing it never alters past orders.
                </p>
              </Card>
            )}
            {serverError && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {serverError}
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button type="submit" loading={isSubmitting} disabled={!isDirty && logo === r.logo_url}>
                Save changes
              </Button>
            </div>
          </form>
        )}

        {tab === 'operations' && (
          <div className="space-y-6">
            <Card title="Tables">
              <div className="space-y-3">
                {toggle(
                  'tables',
                  'cleaning_enabled',
                  'Enable “Cleaning” table status',
                  'Staff can flag a free table as needing cleaning before it shows as available',
                )}
                {toggle(
                  'tables',
                  'allow_multiple_orders',
                  'Allow multiple open orders per table',
                  'When off (recommended), a table with an open order cannot receive a second order — enforced by the database',
                )}
              </div>
            </Card>
            <Card title="Orders">
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Default order type (POS)"
                  value={settings.orders.default_order_type}
                  onChange={(e) =>
                    set('orders', {
                      default_order_type: e.target.value as RestaurantSettings['orders']['default_order_type'],
                    })
                  }
                >
                  <option value="dine_in">Dine-in</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                </Select>
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Cancellations always require a reason and are recorded in the audit trail. Paid orders must be
                  refunded before they can be cancelled.
                </div>
              </div>
            </Card>
            <Card title="Inventory">
              <div className="space-y-3">
                <Select
                  label="Deduct recipe stock"
                  value={settings.inventory.deduct_on}
                  onChange={(e) => set('inventory', { deduct_on: e.target.value as 'completed' | 'none' })}
                >
                  <option value="completed">When the order is completed</option>
                  <option value="none">Never (manual stock control only)</option>
                </Select>
                {toggle(
                  'inventory',
                  'allow_negative_stock',
                  'Allow negative stock',
                  'When off, orders cannot complete and wastage cannot be recorded if stock would drop below zero',
                )}
              </div>
            </Card>
            <Card title="Expenses">
              {toggle(
                'expenses',
                'approval_required',
                'Require approval for new expenses',
                'New expenses start as pending until a manager approves them; only approved expenses count in reports',
              )}
            </Card>
            <div className="flex justify-end">
              <Button onClick={saveSettings} loading={savingOps}>
                Save settings
              </Button>
            </div>
          </div>
        )}

        {tab === 'permissions' && (
          <div className="space-y-6">
            <Card title="Cashier permissions">
              <div className="space-y-3">
                {toggle(
                  'permissions',
                  'cashier_can_cancel_orders',
                  'Cashiers can cancel unpaid orders',
                  'Enforced by the database cancel_order function',
                )}
                {toggle(
                  'permissions',
                  'cashier_can_refund',
                  'Cashiers can issue refunds without approval',
                  'Up to the limit below; larger refunds wait for a manager. Enforced by process_refund',
                )}
                {toggle(
                  'permissions',
                  'cashier_can_create_customers',
                  'Cashiers can create customers',
                  'Enforced by row-level security',
                )}
                {toggle(
                  'permissions',
                  'cashier_can_verify_mobile_money',
                  'Cashiers can verify mobile money payments',
                  'After checking the merchant wallet (EVC Plus, Zaad, Somtel). When off, only managers verify',
                )}
                {toggle(
                  'permissions',
                  'require_open_shift',
                  'Cashiers must open a cash shift before taking payments',
                  'Enforced by record_payments and process_refund',
                )}
                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                  <Input
                    label={`Cashier refund limit without approval (${r.currency})`}
                    name="permissions.cashier_refund_limit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={settings.permissions.cashier_refund_limit}
                    onChange={(e) =>
                      set('permissions', { cashier_refund_limit: Math.max(Number(e.target.value) || 0, 0) })
                    }
                    hint="0 = every cashier refund needs manager approval"
                  />
                  <Input
                    label="Maximum cashier discount (% of subtotal)"
                    name="permissions.cashier_max_discount_percent"
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    value={settings.permissions.cashier_max_discount_percent}
                    onChange={(e) =>
                      set('permissions', {
                        cashier_max_discount_percent: Math.min(Math.max(Number(e.target.value) || 0, 0), 100),
                      })
                    }
                    hint="Enforced by apply_discount and submit_pos_order"
                  />
                </div>
              </div>
            </Card>
            <Card title="Waiter permissions">
              <div className="space-y-3">
                {toggle(
                  'permissions',
                  'waiter_can_create_customers',
                  'Waiters can create customers',
                  'Enforced by row-level security',
                )}
                {toggle(
                  'permissions',
                  'waiter_can_edit_others_orders',
                  'Waiters can add items to colleagues’ orders',
                  'When off, waiters can only change orders they opened',
                )}
                {toggle(
                  'permissions',
                  'waiter_can_cancel_bill_request',
                  'Waiters can cancel unprocessed bill requests',
                  'Only before the cashier starts processing the bill',
                )}
              </div>
            </Card>
            <p className="text-xs text-slate-500">
              Managers always have full access. Waiters can never take payments, refund, or change menu, stock,
              purchasing or expense data. Cashiers can never change product prices.
            </p>
            <div className="flex justify-end">
              <Button onClick={saveSettings} loading={savingOps}>
                Save permissions
              </Button>
            </div>
          </div>
        )}
        {tab === 'group' && (
          <Card title="Group HQ (multi-branch owner)">
            {isOwner && organization ? (
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  This restaurant belongs to the group <b>{organization.name}</b>. Group revenue, staff, menu pushes and
                  audit are in Group HQ.
                </p>
                <Button onClick={() => navigate(HQ_HOME)}>Open Group HQ</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Own more than one restaurant? Create a group to see all branches together: consolidated revenue, tax,
                  staff, audit and central menu prices. Every restaurant you manage joins the group. Branch managers
                  keep working as before.
                </p>
                <Input
                  label="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={r.name}
                  wrapClassName="max-w-md"
                />
                <Button
                  loading={creatingGroup}
                  disabled={groupName.trim().length < 2}
                  onClick={async () => {
                    setCreatingGroup(true);
                    try {
                      await createOrganization(groupName.trim());
                      await reload();
                      toast.success('Group created. Opening Group HQ.');
                      navigate(HQ_HOME);
                    } catch (e) {
                      toast.error(friendlyError(e));
                    } finally {
                      setCreatingGroup(false);
                    }
                  }}
                >
                  Create group
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
