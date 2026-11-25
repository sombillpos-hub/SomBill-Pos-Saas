import { create } from 'zustand';

/**
 * API session state (Zustand).
 *
 * The access token is kept **in memory only**, never in localStorage, so a script injected into the page cannot
 * read it from storage. The refresh token is expected to be an httpOnly cookie set by the API Gateway, which
 * JavaScript never sees. After a page reload the client calls the refresh endpoint to get a new access token.
 */
export interface SessionState {
  accessToken: string | null;
  /** True after the API reported the session as expired and refresh failed. */
  expired: boolean;
  setAccessToken: (token: string | null) => void;
  markExpired: () => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: null,
  expired: false,
  setAccessToken: (accessToken) => set({ accessToken, expired: false }),
  markExpired: () => set({ accessToken: null, expired: true }),
  clear: () => set({ accessToken: null, expired: false }),
}));

/** Non-React access for the HTTP and socket clients. */
export const getAccessToken = (): string | null => useSessionStore.getState().accessToken;
