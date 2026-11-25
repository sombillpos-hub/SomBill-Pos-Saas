import { useEffect, useRef } from 'react';
import { getSocket, type ServerToClientEvents } from '@sombill/api-client/socket';

/**
 * Subscribes a component to one Socket.IO event for as long as it is mounted.
 * The latest handler is always used, so callers do not need to memoise it.
 */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E],
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) =>
      (handlerRef.current as (...a: Parameters<ServerToClientEvents[E]>) => void)(...args)) as ServerToClientEvents[E];
    // Socket.IO's typed `on`/`off` overloads cannot be expressed for a generic event key.
    const s = socket as unknown as {
      on: (e: string, l: (...a: unknown[]) => void) => void;
      off: (e: string, l: (...a: unknown[]) => void) => void;
    };
    s.on(event, listener as (...a: unknown[]) => void);
    return () => s.off(event, listener as (...a: unknown[]) => void);
  }, [event, enabled]);
}
