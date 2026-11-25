import { pino, type Logger, type LevelWithSilent } from 'pino';

export type { Logger } from 'pino';

/** Paths that must never reach logs (tokens, passwords, cookies). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.refreshToken',
  '*.accessToken',
  '*.token',
  '*.passwordHash',
];

export function createLogger(service: string, level: LevelWithSilent = 'info'): Logger {
  return pino({
    level,
    base: { service },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
