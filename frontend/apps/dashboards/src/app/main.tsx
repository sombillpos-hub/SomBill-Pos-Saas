import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startSomBillAutoSync } from '@sombill/api-client/restClient';
import '@/features/auth/enforceSession';
import App from './App';
import { AppProviders } from './providers/AppProviders';
import '@/styles/index.css';
import '@sombill/shared-ui/styles/design-system/index.css';
import '@sombill/super-admin/styles/superadmin.css';
import '@/styles/auth.css';

startSomBillAutoSync();

if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
