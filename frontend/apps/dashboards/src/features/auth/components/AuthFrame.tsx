import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download, Globe2, Headset, ShieldCheck, UtensilsCrossed, Zap } from 'lucide-react';
import { Logo } from '@sombill/shared-ui/Logo';
import { authConfig, supportHref } from '../config';
import { LANGS, type AuthLang } from '../i18n';
import { useInstallPrompt, useOnline } from '../useInstallPrompt';

/** The flame squircle. Uses the official logo when it exists, otherwise the "S" mark. */
function Squircle() {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(500px) rotateX(${(-y * 18).toFixed(1)}deg) rotateY(${(x * 18).toFixed(1)}deg) scale(1.05)`;
  };
  return (
    <div
      ref={ref}
      className="au-squircle"
      onPointerMove={move}
      onPointerLeave={() => ref.current && (ref.current.style.transform = '')}
      aria-hidden
    >
      {failed ? <span>S</span> : <img src="/branding/sombill-logo.png" alt="" onError={() => setFailed(true)} />}
    </div>
  );
}

function LangSwitch({ auth }: { auth: AuthLang }) {
  return (
    <div className="au-lang" role="group" aria-label={auth.t('language')}>
      <Globe2 className="h-4 w-4" aria-hidden />
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          aria-pressed={auth.lang === l.id}
          title={l.name}
          onClick={() => auth.setLang(l.id)}
        >
          {auth.lang === l.id && (
            <motion.i
              layoutId="au-lang-pill"
              className="au-lang-pill"
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            />
          )}
          <span>{l.short}</span>
        </button>
      ))}
    </div>
  );
}

/** Two-column glass card on the obsidian backdrop. The form panel is passed as children. */
export function AuthFrame({ auth, children }: { auth: AuthLang; children: ReactNode }) {
  const { t, lang, dir } = auth;
  const { canInstall, install } = useInstallPrompt();
  const online = useOnline();
  const features = [
    { Icon: Zap, title: t('f1t'), text: t('f1d') },
    { Icon: ShieldCheck, title: t('f2t'), text: t('f2d') },
    { Icon: BarChart3, title: t('f3t'), text: t('f3d') },
  ];
  return (
    <div className="auth-viewport" dir={dir} lang={lang}>
      <div className="auth-master-card">
        <aside className="au-showcase">
          <div className="au-dots" aria-hidden />
          <Squircle />
          <div className="au-showcase-copy">
            <p className="au-product">
              SomBill <span>POS</span>
            </p>
            <i className="au-rule" aria-hidden />
            <h2>{t('showcaseTagline')}</h2>
            <p>{t('showcaseBody')}</p>
          </div>
          <ul className="au-features">
            {features.map(({ Icon, title, text }) => (
              <li key={title}>
                <Icon className="h-5 w-5" aria-hidden />
                <b>{title}</b>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="au-panel">
          <div className="au-bar">
            {canInstall ? (
              <button type="button" className="au-install" onClick={() => void install()}>
                <Download className="h-4 w-4" aria-hidden /> {t('install')}
              </button>
            ) : (
              <span />
            )}
            <LangSwitch auth={auth} />
          </div>
          <div className="au-logo">
            <Logo className="h-11" />
          </div>
          {children}
          <div className="au-help">
            <span className="au-help-icon" aria-hidden>
              <Headset className="h-5 w-5" />
            </span>
            <p>
              <b>{t('helpTitle')}</b>
              <span>{t('helpText')}</span>
            </p>
            <a href={supportHref()} target="_blank" rel="noopener noreferrer">
              {t('contact')}
            </a>
          </div>
        </section>
      </div>

      <footer className="au-foot">
        {authConfig.publicMenuUrl && (
          <a className="au-menu-link" href={authConfig.publicMenuUrl} target="_blank" rel="noopener noreferrer">
            <UtensilsCrossed className="h-4 w-4" aria-hidden /> {t('menu')}
          </a>
        )}
        <p>
          {t('copyright')}
          <span className="au-status" data-online={online} role="status">
            <i aria-hidden /> {online ? t('online') : t('offline')}
          </span>
        </p>
      </footer>
    </div>
  );
}
