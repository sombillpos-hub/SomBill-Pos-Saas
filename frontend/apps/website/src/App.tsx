import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DEFAULT_EXCHANGE_RATE, Language } from './utils/currency';
import { SomBillWebsite } from './layouts/SomBillWebsite';
import { ChatBotWidget } from './components/chatbot/ChatBotWidget';
import { DASHBOARD_ROUTES } from './services/siteConfig';

export default function App() {
  // Default Theme & Language: White / Light Mode + English
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [lang, setLang] = useState<Language>('en');
  const [exchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3400);
  };

  const handleLaunchLivePreview = (mode: 'cashier' | 'waiter' | 'manager' | 'admin') => {
    const targetMap: Record<typeof mode, string> = {
      cashier: DASHBOARD_ROUTES.cashier,
      waiter: DASHBOARD_ROUTES.waiter,
      manager: DASHBOARD_ROUTES.manager,
      admin: DASHBOARD_ROUTES.superAdmin,
    };
    const labelMap: Record<typeof mode, string> = {
      cashier: 'Cashier POS Workspace',
      waiter: 'Waiter & Floor POS',
      manager: 'Manager Dashboard',
      admin: 'Super Admin / Group HQ Console',
    };

    showToast(`Opening ${labelMap[mode]}…`);
    window.location.assign(targetMap[mode]);
  };

  return (
    <>
      <SomBillWebsite
        lang={lang}
        onToggleLang={() => {
          const next: Language = lang === 'en' ? 'so' : 'en';
          setLang(next);
          showToast(
            next === 'so'
              ? 'Af-Soomaali ayaa loo beddelay (Switched to Somali)'
              : 'Switched interface language to English',
          );
        }}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        exchangeRate={exchangeRate}
        onLaunchLiveApp={handleLaunchLivePreview}
        onToast={showToast}
      />

      <ChatBotWidget currentPathname={undefined} onNavigatePath={undefined} onOpenDemoModal={undefined} />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-[#E11D48] shadow-xl flex items-center gap-2 text-xs font-semibold transition-sombill"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
