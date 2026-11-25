import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { z } from 'zod';
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { roleHome, useAuth } from '@sombill/shared-hooks/AuthContext';
import { loginSchema } from '@sombill/shared-types/schemas';
import { supabase, supabaseConfigured, friendlyError } from '@sombill/api-client/supabase';
import { FullPageLoader } from '@/app/router/ProtectedRoute';
import { AuthFrame } from '../components/AuthFrame';
import { NewPasswordForm } from '../components/NewPasswordForm';
import { OtpInput } from '../components/OtpInput';
import { Spinner } from '../components/Spinner';
import { authConfig } from '../config';
import { useAuthLang } from '../i18n';
import { applyRememberMe } from '../session';

type LoginForm = z.input<typeof loginSchema>;
type View = 'signin' | 'email' | 'otp' | 'new';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Counts down once per second after `start()`. */
function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, setLeft] as const;
}

export function LoginPage() {
  const auth = useAuthLang();
  const { t } = auth;
  const { signIn, signOut, reload, access, role, session, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  const [view, setView] = useState<View>('signin');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Set while someone is proving their email with a code: they get a session before they have chosen a new password,
  // and must not be redirected into the app until the password is saved.
  const recovering = useRef(false);

  // ---- sign in
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [remember, setRemember] = useState(true);
  const [emailFocus, setEmailFocus] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const emailReg = register('email');
  const typed = watch('email') ?? '';

  // ---- forgot password
  const [resetEmail, setResetEmail] = useState('');
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeBad, setCodeBad] = useState(false);
  const [left, setLeft] = useCountdown();

  const go = useCallback((v: View) => {
    setError(null);
    setNotice(null);
    setView(v);
  }, []);

  if (access === 'loading') return <FullPageLoader />;
  // Without a session the visitor is signed out, even when the development preview shows sample data elsewhere.
  if (access !== 'signed_out' && session && !recovering.current) return <Navigate to={roleHome(role)} replace />;

  const fieldError = (m?: string) =>
    m === 'Enter a valid email address' ? t('badEmail') : m === 'Enter your password' ? t('needPassword') : m;

  const onSubmit = async (v: LoginForm) => {
    setError(null);
    try {
      await signIn(v.email, v.password);
      applyRememberMe(remember);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openForgot = () => {
    setResetEmail(typed.trim());
    setResetErr(null);
    setCode('');
    go('email');
  };

  const sendCode = async () => {
    const email = resetEmail.trim();
    if (!z.string().email().safeParse(email).success) return setResetErr(t('badEmail'));
    setResetErr(null);
    setSending(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (e) return setResetErr(friendlyError(e));
    setCode('');
    setCodeBad(false);
    setLeft(authConfig.resendSeconds);
    setNotice(t('sent'));
    setView('otp');
  };

  const verify = async (token: string) => {
    setVerifying(true);
    setCodeBad(false);
    recovering.current = true;
    const { error: e } = await supabase.auth.verifyOtp({ email: resetEmail.trim(), token, type: 'recovery' });
    setVerifying(false);
    if (e) {
      recovering.current = false;
      setCode('');
      setCodeBad(true);
      return;
    }
    go('new');
  };

  const backToSignIn = async () => {
    if (view === 'new') {
      recovering.current = false;
      await signOut();
    }
    go('signin');
  };

  const finishNewPassword = async () => {
    recovering.current = false;
    await reload();
    navigate('/', { replace: true });
  };

  const slide = reduce
    ? {}
    : {
        initial: { opacity: 0, x: auth.dir === 'rtl' ? -28 : 28, rotateY: -10 },
        animate: { opacity: 1, x: 0, rotateY: 0 },
        exit: { opacity: 0, x: auth.dir === 'rtl' ? 28 : -28, rotateY: 10 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      };

  const local = typed.split('@')[0] ?? '';
  const domainPart = typed.includes('@') ? typed.slice(typed.indexOf('@') + 1) : '';
  const chips = authConfig.emailDomains.filter((d) => d.startsWith(domainPart) && d !== domainPart);
  const showChips = emailFocus && local.length > 0 && chips.length > 0;

  return (
    <AuthFrame auth={auth}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} className="au-view" {...slide}>
          {view === 'signin' && (
            <>
              <h1 className="au-title">{t('welcome')}</h1>
              <p className="au-sub">{t('subtitle')}</p>
              {!supabaseConfigured && (
                <p role="alert" className="au-alert">
                  {t('notConfigured')}
                </p>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="au-form" noValidate>
                <div className="au-field">
                  <label htmlFor="au-email">{t('email')}</label>
                  <div className="au-control" data-invalid={Boolean(errors.email)}>
                    <Mail className="au-icon" aria-hidden />
                    <input
                      id="au-email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder={t('emailPh')}
                      {...emailReg}
                      onFocus={() => setEmailFocus(true)}
                      onBlur={(e) => {
                        void emailReg.onBlur(e);
                        setEmailFocus(false);
                      }}
                    />
                  </div>
                  {errors.email && (
                    <p role="alert" className="au-err">
                      {fieldError(errors.email.message)}
                    </p>
                  )}
                  {showChips && (
                    <div className="au-chips" aria-label="Email domains">
                      {chips.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setValue('email', `${local}@${d}`, { shouldValidate: true, shouldDirty: true });
                            setFocus('password');
                          }}
                        >
                          @{d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="au-field">
                  <div className="au-label-row">
                    <label htmlFor="au-password">{t('password')}</label>
                    <button type="button" className="au-link" onClick={openForgot}>
                      {t('forgot')}
                    </button>
                  </div>
                  <div className="au-control" data-invalid={Boolean(errors.password)}>
                    <Lock className="au-icon" aria-hidden />
                    <input
                      id="au-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('passwordPh')}
                      {...register('password')}
                      onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))}
                      onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                    />
                    <button
                      type="button"
                      className="au-eye"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? t('hidePw') : t('showPw')}
                      aria-pressed={showPw}
                    >
                      <motion.span
                        key={String(showPw)}
                        initial={reduce ? false : { scale: 0.55, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 14 }}
                      >
                        {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </motion.span>
                    </button>
                  </div>
                  {caps && (
                    <p role="status" className="au-caps">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {t('caps')}
                    </p>
                  )}
                  {errors.password && (
                    <p role="alert" className="au-err">
                      {fieldError(errors.password.message)}
                    </p>
                  )}
                </div>

                <div className="au-remember">
                  <label className="au-check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span className="au-check-box" aria-hidden>
                      <svg viewBox="0 0 16 16">
                        <path d="M3.5 8.5 6.8 11.8 12.5 4.6" />
                      </svg>
                    </span>
                    <span>{t('remember')}</span>
                  </label>
                  <small>{t('keepSigned')}</small>
                </div>

                {(error || authError) && (
                  <p role="alert" className="au-alert">
                    {error || authError}
                  </p>
                )}

                <button type="submit" className="au-primary" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner /> : null}
                  <span>{isSubmitting ? t('signingIn') : t('signIn')}</span>
                  {!isSubmitting && <ArrowRight className="au-arrow h-[18px] w-[18px]" aria-hidden />}
                </button>
              </form>

              {authConfig.googleEnabled && (
                <>
                  <p className="au-or">
                    <span>{t('orWith')}</span>
                  </p>
                  <button
                    type="button"
                    className="au-social"
                    onClick={() =>
                      void supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo: `${window.location.origin}/` },
                      })
                    }
                  >
                    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"
                      />
                      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
                      <path
                        fill="#34A853"
                        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
                      />
                    </svg>
                    {t('google')}
                  </button>
                </>
              )}
            </>
          )}

          {view === 'email' && (
            <>
              <h1 className="au-title">{t('forgotTitle')}</h1>
              <p className="au-sub">{t('forgotSub')}</p>
              <form
                className="au-form"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendCode();
                }}
              >
                <div className="au-field">
                  <label htmlFor="au-reset-email">{t('email')}</label>
                  <div className="au-control" data-invalid={Boolean(resetErr)}>
                    <Mail className="au-icon" aria-hidden />
                    <input
                      id="au-reset-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      placeholder={t('emailPh')}
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                  {resetErr && (
                    <p role="alert" className="au-err">
                      {resetErr}
                    </p>
                  )}
                </div>
                <button type="submit" className="au-primary" disabled={sending}>
                  {sending ? <Spinner /> : null}
                  <span>{sending ? t('sending') : t('sendCode')}</span>
                  {!sending && <ArrowRight className="au-arrow h-[18px] w-[18px]" aria-hidden />}
                </button>
              </form>
            </>
          )}

          {view === 'otp' && (
            <>
              <h1 className="au-title">{t('codeTitle')}</h1>
              <p className="au-sub">{t('codeSub', { email: resetEmail.trim() })}</p>
              {notice && (
                <p role="status" className="au-ok">
                  {notice}
                </p>
              )}
              <div className="au-form">
                <OtpInput
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    setCodeBad(false);
                  }}
                  onComplete={(v) => void verify(v)}
                  label={t('codeLabel')}
                  digitLabel={(n) => t('digit', { n })}
                  disabled={verifying}
                  invalid={codeBad}
                />
                {codeBad && (
                  <p role="alert" className="au-alert">
                    {t('codeBad')}
                  </p>
                )}
                <button
                  type="button"
                  className="au-primary"
                  disabled={verifying || code.length < 6}
                  onClick={() => void verify(code)}
                >
                  {verifying ? <Spinner /> : null}
                  <span>{verifying ? t('verifying') : t('verify')}</span>
                </button>
                <p className="au-resend">
                  {left > 0 ? (
                    <span>{t('resendIn', { time: mmss(left) })}</span>
                  ) : (
                    <button type="button" className="au-link" onClick={() => void sendCode()} disabled={sending}>
                      {t('resend')}
                    </button>
                  )}
                </p>
              </div>
            </>
          )}

          {view === 'new' && (
            <>
              <h1 className="au-title">{t('newTitle')}</h1>
              <p className="au-sub">{t('newSub')}</p>
              <NewPasswordForm auth={auth} onSaved={finishNewPassword} />
            </>
          )}

          {view !== 'signin' && (
            <button type="button" className="au-back" onClick={() => void backToSignIn()}>
              <ArrowLeft className="au-back-icon h-4 w-4" aria-hidden /> {t('back')}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthFrame>
  );
}
