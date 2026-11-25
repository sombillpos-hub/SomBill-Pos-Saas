import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { Button } from '@sombill/shared-ui/ui/Button';
import { Input } from '@sombill/shared-ui/ui/Field';
import { Logo } from '@sombill/shared-ui/Logo';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the restaurant name').max(120),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, '3-letter code, e.g. USD or SLS'),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone'),
});
type Form = z.input<typeof schema>;

/** First-run: an authenticated user without a restaurant creates one and becomes its manager. */
export function SetupRestaurantPage() {
  const { reload, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', currency: 'USD', timezone: 'Africa/Mogadishu' },
  });
  const onSubmit = async (raw: Form) => {
    const v = schema.parse(raw);
    setError(null);
    const { error: e } = await supabase.rpc('create_restaurant', {
      p_name: v.name,
      p_currency: v.currency,
      p_timezone: v.timezone,
    });
    if (e) {
      setError(friendlyError(e));
      return;
    }
    await reload();
  };
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% -15%, rgba(220,38,38,0.12), transparent 70%), radial-gradient(ellipse 60% 45% at 88% 20%, rgba(249,115,22,0.09), transparent 65%), #fffaf9',
      }}
    >
      <div className="card relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#fbbf24]"
          aria-hidden
        />
        <Logo />
        <h1 className="mt-6 text-xl font-extrabold tracking-tight text-slate-900">Set up your restaurant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your account isn’t linked to a restaurant yet. Create one to become its manager. Staff members should instead
          ask their manager for an invitation.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
          <Input label="Restaurant name" {...register('name')} error={errors.name?.message} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Currency" {...register('currency')} error={errors.currency?.message} maxLength={3} />
            <Input
              label="Time zone"
              {...register('timezone')}
              error={errors.timezone?.message}
              hint="Hargeisa: Africa/Mogadishu (EAT)"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create restaurant
          </Button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full text-center text-sm text-slate-500 hover:text-brand-red"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
