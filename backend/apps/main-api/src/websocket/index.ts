import type { Response } from 'express';

/**
 * Real-time channel (kitchen display, order status, tables, payments, waiter calls).
 * Implements an in-process pub/sub broker backed by Server-Sent Events (SSE) so every connected
 * dashboard (Manager, Cashier, Waiter, Super Admin) receives live push events over standard HTTP
 * through both Vite dev proxy and Nginx without external broker dependencies.
 */
export interface RealtimeChannel {
  /** Publishes a payload to every connected client of an organization/branch room (or '*' for global). */
  broadcast(room: string, event: string, payload: unknown): void;
  /** Attaches an Express SSE response stream to a room. Returns an unsubscribe cleanup callback. */
  subscribe(room: string, res: Response): () => void;
  /** Returns the current number of connected realtime listeners. */
  clientCount(): number;
  close(): Promise<void>;
}

interface Client {
  id: string;
  room: string;
  res: Response;
}

class InMemoryRealtimeChannel implements RealtimeChannel {
  private readonly clients = new Map<string, Client>();
  private seq = 0;

  subscribe(room: string, res: Response): () => void {
    const id = `rt-${++this.seq}`;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.set(id, { id, room, res });
    res.write(`event: connected\ndata: ${JSON.stringify({ id, room, ts: new Date().toISOString() })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        this.clients.delete(id);
        clearInterval(keepAlive);
      }
    }, 25_000);

    return () => {
      clearInterval(keepAlive);
      this.clients.delete(id);
    };
  }

  broadcast(room: string, event: string, payload: unknown): void {
    const frame = `event: ${event}\ndata: ${JSON.stringify({ room, event, payload, ts: new Date().toISOString() })}\n\n`;
    for (const client of this.clients.values()) {
      if (client.room === '*' || room === '*' || client.room === room) {
        try {
          client.res.write(frame);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  clientCount(): number {
    return this.clients.size;
  }

  async close(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
        /* ignore closed socket */
      }
    }
    this.clients.clear();
  }
}

export const realtimeChannel: RealtimeChannel = new InMemoryRealtimeChannel();
