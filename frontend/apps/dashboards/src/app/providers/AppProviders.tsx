import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { queryClient } from '@sombill/api-client/queryClient';
import { SESSION_EXPIRED_EVENT } from '@sombill/api-client/httpClient';

/**
 * App-wide providers that sit above routing and auth:
 * - TanStack Query for server state (caching, refetching, mutations).
 * - Framer Motion config: animations respect the user's "reduce motion" setting.
 * When the API session expires, cached server data is dropped so nothing stale stays on screen.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onExpired = () => queryClient.clear();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}
