import { useEffect, useState } from 'react';

export type NetworkSpeed = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

export interface NetworkProfile {
  online: boolean;
  effectiveType: NetworkSpeed;
  saveData: boolean;
  /** True on 2G/3G, Save-Data, low-RAM (<=2GB), or prefers-reduced-motion. Disables heavy blur/particles. */
  liteMode: boolean;
}

interface NavigatorConnectionLike {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function readNetworkProfile(): NetworkProfile {
  if (typeof navigator === 'undefined') {
    return { online: true, effectiveType: '4g', saveData: false, liteMode: false };
  }
  const nav = navigator as Navigator & {
    connection?: NavigatorConnectionLike;
    mozConnection?: NavigatorConnectionLike;
    webkitConnection?: NavigatorConnectionLike;
    deviceMemory?: number;
  };
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  const rawType = conn?.effectiveType;
  const effectiveType: NetworkSpeed =
    rawType === 'slow-2g' || rawType === '2g' || rawType === '3g' || rawType === '4g' ? rawType : 'unknown';
  const saveData = Boolean(conn?.saveData);
  const lowRam = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2;
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slowNet = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

  return {
    online: navigator.onLine,
    effectiveType,
    saveData,
    liteMode: slowNet || saveData || lowRam || reducedMotion,
  };
}

/**
 * Monitors browser network speed (2G/3G/4G/Wi-Fi), Save-Data, and device memory.
 * Applies `data-sb-lite="true"` on `<html>` when on slow connections or low-RAM hardware
 * so heavy particles/blur automatically step down for smooth performance.
 */
export function useNetworkProfile(): NetworkProfile {
  const [profile, setProfile] = useState<NetworkProfile>(() => readNetworkProfile());

  useEffect(() => {
    const sync = () => {
      const next = readNetworkProfile();
      setProfile(next);
      const root = document.documentElement;
      if (next.liteMode) root.setAttribute('data-sb-lite', 'true');
      else root.removeAttribute('data-sb-lite');
      root.setAttribute('data-sb-net', next.effectiveType);
    };
    sync();

    const nav = navigator as Navigator & {
      connection?: NavigatorConnectionLike;
      mozConnection?: NavigatorConnectionLike;
      webkitConnection?: NavigatorConnectionLike;
    };
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    conn?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      conn?.removeEventListener?.('change', sync);
    };
  }, []);

  return profile;
}
