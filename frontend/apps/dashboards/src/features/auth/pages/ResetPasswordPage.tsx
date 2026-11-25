import { useNavigate } from 'react-router-dom';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { FullPageLoader } from '@/app/router/ProtectedRoute';
import { AuthFrame } from '../components/AuthFrame';
import { NewPasswordForm } from '../components/NewPasswordForm';
import { useAuthLang } from '../i18n';

/** Landing page for invite and password-recovery links sent by Supabase Auth. */
export function ResetPasswordPage() {
  const auth = useAuthLang();
  const { session, access, reload } = useAuth();
  const navigate = useNavigate();
  if (access === 'loading') return <FullPageLoader />;

  return (
    <AuthFrame auth={auth}>
      <h1 className="au-title">{auth.t('linkTitle')}</h1>
      {!session ? (
        <p className="au-alert" role="alert">
          {auth.t('linkInvalid')}
        </p>
      ) : (
        <>
          <p className="au-sub">{auth.t('newSub')}</p>
          <NewPasswordForm
            auth={auth}
            onSaved={async () => {
              await reload();
              navigate('/', { replace: true });
            }}
          />
        </>
      )}
    </AuthFrame>
  );
}
