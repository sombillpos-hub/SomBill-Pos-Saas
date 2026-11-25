import { render } from '@testing-library/react';
import { useSessionStore } from '@sombill/api-client/sessionStore';

const fake = vi.hoisted(() => {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  const socket = {
    connected: false,
    connect: vi.fn(() => {
      socket.connected = true;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
    }),
    emit: vi.fn(),
    on: vi.fn((e: string, l: (...a: unknown[]) => void) => {
      if (!handlers.has(e)) handlers.set(e, new Set());
      handlers.get(e)!.add(l);
    }),
    off: vi.fn((e: string, l: (...a: unknown[]) => void) => handlers.get(e)?.delete(l)),
    removeAllListeners: vi.fn(() => handlers.clear()),
    fire: (e: string, ...args: unknown[]) => handlers.get(e)?.forEach((l) => l(...args)),
  };
  return { socket, io: vi.fn(() => socket) };
});
vi.mock('socket.io-client', () => ({ io: fake.io }));

import { connectSocket, disconnectSocket, getSocket, resetSocketForTests } from '@sombill/api-client/socket';
import { useSocketEvent } from '@sombill/shared-hooks/useSocketEvent';

describe('socket client', () => {
  beforeEach(() => {
    resetSocketForTests();
    fake.io.mockClear();
    fake.socket.connected = false;
  });

  it('is created lazily, does not auto-connect, and sends the current access token on connect', () => {
    getSocket();
    getSocket();
    expect(fake.io).toHaveBeenCalledTimes(1);
    const [, options] = fake.io.mock.calls[0] as unknown as [
      string,
      { autoConnect: boolean; auth: (cb: (d: unknown) => void) => void },
    ];
    expect(options.autoConnect).toBe(false);
    useSessionStore.getState().setAccessToken('live-token');
    const cb = vi.fn();
    options.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: 'live-token' });
  });

  it('connects once and joins the restaurant room', () => {
    connectSocket('r1');
    connectSocket('r1');
    expect(fake.socket.connect).toHaveBeenCalledTimes(1);
    expect(fake.socket.emit).toHaveBeenCalledWith('restaurant:join', 'r1');
    disconnectSocket();
    expect(fake.socket.disconnect).toHaveBeenCalled();
  });

  it('useSocketEvent subscribes while mounted and always calls the latest handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    function Listener({ onEvent }: { onEvent: (p: { orderId: string }) => void }) {
      useSocketEvent('order:created', (p) => onEvent(p));
      return null;
    }
    const { rerender, unmount } = render(<Listener onEvent={first} />);
    rerender(<Listener onEvent={second} />);
    fake.socket.fire('order:created', { orderId: 'o1', restaurantId: 'r1' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ orderId: 'o1', restaurantId: 'r1' });
    unmount();
    fake.socket.fire('order:created', { orderId: 'o2', restaurantId: 'r1' });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
