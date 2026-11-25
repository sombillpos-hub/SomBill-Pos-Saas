import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Slides in under the topbar while the browser is offline. States the real consequence: nothing can be saved or sent. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div className="sb-offline-banner no-print" role="alert">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>You are offline. Orders and payments can’t be sent until the connection returns.</span>
    </div>
  );
}
