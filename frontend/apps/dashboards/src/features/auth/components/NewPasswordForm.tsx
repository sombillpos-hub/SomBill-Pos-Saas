import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { passwordSchema } from '@sombill/shared-types/schemas';
import { supabase, friendlyError } from '@sombill/api-client/supabase';
import type { AuthLang } from '../i18n';
import { Spinner } from './Spinner';

type Form = z.input<typeof passwordSchema>;

/** Sets a new password for the person who has just proved their email (code or link). */
export function NewPasswordForm({ auth, onSaved }: { auth: AuthLang; onSaved: () => Promise<void> | void }) {
  const { t } = auth;
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(passwordSchema) });
  const msg = (m?: string) =>
    m === 'Use at least 10 characters'
      ? t('pwShort')
      : m === 'Include a letter'
        ? t('pwLetter')
        : m === 'Include a number'
          ? t('pwNumber')
          : m === 'Passwords do not match'
            ? t('pwMatch')
            : m;

  const submit = async (v: Form) => {
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password: v.password });
    if (e) return setError(friendlyError(e));
    await onSaved();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="au-form" noValidate>
      <div className="au-field">
        <label htmlFor="au-new-pw">{t('newPw')}</label>
        <div className="au-control" data-invalid={Boolean(errors.password)}>
          <Lock className="au-icon" aria-hidden />
          <input id="au-new-pw" type="password" autoComplete="new-password" {...register('password')} />
        </div>
        {errors.password && (
          <p role="alert" className="au-err">
            {msg(errors.password.message)}
          </p>
        )}
      </div>
      <div className="au-field">
        <label htmlFor="au-confirm-pw">{t('confirmPw')}</label>
        <div className="au-control" data-invalid={Boolean(errors.confirm)}>
          <Lock className="au-icon" aria-hidden />
          <input id="au-confirm-pw" type="password" autoComplete="new-password" {...register('confirm')} />
        </div>
        {errors.confirm && (
          <p role="alert" className="au-err">
            {msg(errors.confirm.message)}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="au-alert">
          {error}
        </p>
      )}
      <button type="submit" className="au-primary" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : null}
        <span>{isSubmitting ? t('saving') : t('savePw')}</span>
      </button>
    </form>
  );
}
