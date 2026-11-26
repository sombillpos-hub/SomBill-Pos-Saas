#!/usr/bin/env node
/**
 * SomBill Local LAN Thermal Print Bridge (zero external dependencies).
 *
 * Forwards raw ESC/POS bytes from the browser to any Ethernet / Wi-Fi thermal printer
 * listening on raw TCP port 9100 (Epson, Star, Xprinter, Rongta, BIXOLON, Sunmi, etc.).
 *
 * Usage:
 *   npm run print-bridge
 *   # or: PORT=9191 node scripts/thermal-print-bridge.mjs
 *
 * Endpoints:
 *   GET  /health
 *   POST /print?host=192.168.1.100&port=9100   (body: raw ESC/POS bytes)
 */
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PRINT_BRIDGE_PORT || process.env.PORT || 9191);
const HOST = process.env.PRINT_BRIDGE_HOST || '127.0.0.1';
const MAX_BODY_BYTES = 512 * 1024; // 512 KB

function setCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function sendRawTcp(host, port, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs, () => finish(new Error(`Timed out connecting to printer ${host}:${port}`)));
    socket.on('error', (err) => finish(err));
    socket.on('connect', () => {
      socket.write(payload, (writeErr) => {
        if (writeErr) return finish(writeErr);
        socket.end(() => finish());
      });
    });
  });
}

const server = http.createServer((req, res) => {
  setCors(res, req.headers.origin);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, service: 'sombill-thermal-print-bridge', port: PORT }));
  }

  if (req.method === 'POST' && url.pathname === '/print') {
    const printerHost = (url.searchParams.get('host') || '').trim();
    const printerPort = Number(url.searchParams.get('port') || 9100);
    if (!printerHost || !/^[a-zA-Z0-9.-]+$/.test(printerHost)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Invalid or missing printer host IP.' }));
    }
    if (!Number.isInteger(printerPort) || printerPort < 1 || printerPort > 65535) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Invalid printer TCP port.' }));
    }

    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Print payload too large.' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      const payload = Buffer.concat(chunks);
      if (payload.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'Empty ESC/POS payload.' }));
      }
      try {
        await sendRawTcp(printerHost, printerPort, payload);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, bytes: payload.length, host: printerHost, port: printerPort }));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not found. Use GET /health or POST /print?host=<ip>&port=9100' }));
});

server.listen(PORT, HOST, () => {
  console.log(`SomBill Thermal Print Bridge listening on http://${HOST}:${PORT}`);
  console.log(`POST raw ESC/POS bytes to http://${HOST}:${PORT}/print?host=<PRINTER_IP>&port=9100`);
});
