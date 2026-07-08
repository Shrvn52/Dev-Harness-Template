import { LOG_LEVEL, type LogLevel } from '../config.js';

/**
 * The sanctioned logging path for backend/src — the thing the `no-console`
 * lint rule points at. One JSON object per line, so any collector (or `jq`)
 * can consume it without a parser plugin:
 *
 *   logger.info('item created', { id: item.id });
 *   → {"level":"info","time":"…","msg":"item created","id":1}
 *
 * warn/error go to stderr, debug/info to stdout. Threshold comes from
 * LOG_LEVEL (config.ts — default 'info'). Deliberately dependency-free and
 * writing via process.std{out,err}.write, NOT console: console is lint-banned
 * in backend/src, and this module must not need an exception to exist.
 *
 * When you outgrow it (child loggers, redaction, sampling), swap in pino
 * behind this same four-method surface — callers never import pino directly.
 */

const ORDER: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const THRESHOLD = ORDER.indexOf(LOG_LEVEL);

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  if (ORDER.indexOf(level) < THRESHOLD) return;
  const line = `${JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields })}\n`;
  (level === 'warn' || level === 'error' ? process.stderr : process.stdout).write(line);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>): void => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>): void => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>): void => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>): void => emit('error', msg, fields),
};
