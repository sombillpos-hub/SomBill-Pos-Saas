import { io, type Socket } from 'socket.io-client';
import { env } from '@sombill/shared-config/env';
import { getAccessToken } from '@sombill/api-client/sessionStore';

/**
 * Real-time events the dashboards listen for (server → client). Payloads carry IDs and the changed fields;
 * screens re-read details through the API or invalidate their TanStack Query keys.
 * Event names are the frontend's proposal and will be aligned with the backend's contract.
 */
export interface ServerToClientEvents {
  'order:created': (payload: {
    orderId: string;
    restaurantId: string;
    tableId?: string | null;
    orderNumber?: number;
  }) => void;
  'order:status': (payload: {
    orderId: string;
    restaurantId: string;
    status: string;
    preparationStatus?: string;
  }) => void;
  'table:status': (payload: { tableId: string; restaurantId: string; status: string }) => void;
  'payment:updated': (payload: {
    orderId: string;
    restaurantId: string;
    paymentStatus: string;
    amountPaid?: number;
  }) => void;
  notification: (payload: { id: string; title: string; body?: string; type?: string; createdAt: string }) => void;
}

/** Client → server events. */
export interface ClientToServerEvents {
  'restaurant:join': (restaurantId: string) => void;
  'restaurant:leave': (restaurantId: string) => void;
}

export type SombillSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: SombillSocket | null = null;

/** Lazily creates the shared socket. It does not connect until `connectSocket()` is called. */
export function getSocket(): SombillSocket {
  socket ??= io(env.socketUrl, {
    path: env.socketPath,
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Called on every (re)connect, so a renewed access token is picked up automatically.
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  return socket;
}

export function connectSocket(restaurantId?: string): SombillSocket {
  const s = getSocket();
  if (!s.connected) s.connect();
  if (restaurantId) s.emit('restaurant:join', restaurantId);
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

/** For tests only. */
export function resetSocketForTests(): void {
  socket?.removeAllListeners();
  socket = null;
}
