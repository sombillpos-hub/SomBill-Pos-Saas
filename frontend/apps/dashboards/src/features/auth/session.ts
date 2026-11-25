/**
 * "Remember me". Supabase keeps the session in localStorage. When the person unticks the box we mark the session as
 * temporary (flag in localStorage plus a sessionStorage twin that disappears when the browser tab closes). On the next
 * start, if the flag is present but its twin is gone, the stored session is removed before the app reads it.
 */
const FLAG = 'sombill.session.temp';

export function applyRememberMe(remember: boolean): void {
  try {
    if (remember) {
      localStorage.removeItem(FLAG);
      sessionStorage.removeItem(FLAG);
    } else {
      localStorage.setItem(FLAG, '1');
      sessionStorage.setItem(FLAG, '1');
    }
  } catch {
    /* storage unavailable */
  }
}

export function enforceTemporarySession(): boolean {
  try {
    if (localStorage.getItem(FLAG) === '1' && sessionStorage.getItem(FLAG) !== '1') {
      for (const k of Object.keys(localStorage))
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
      localStorage.removeItem(FLAG);
      return true;
    }
  } catch {
    /* storage unavailable */
  }
  return false;
}
