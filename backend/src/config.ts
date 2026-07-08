/**
 * Single place every environment variable is resolved. Fail LOUD at boot on an
 * invalid value — an unparseable PORT should crash now, not surface later as a
 * confusing EADDRINUSE. Mirror this table in CLAUDE.md (Env vars) and .env.example.
 *
 * `console.*` is permitted here (boot-path eslint exception): the logger isn't up
 * yet, and a config crash must reach stderr.
 */

function readPort(): number {
  const raw = process.env.PORT ?? '8137';
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`[config] invalid PORT="${raw}" — expected an integer in 1..65535`);
    process.exit(1);
  }
  return n;
}

/** HTTP port. Default 8137. */
export const PORT = readPort();

/** Bind address. Default loopback. */
export const HOST = process.env.HOST ?? '127.0.0.1';

/** SQLite location. Default in-memory (no file artifact; resets per process).
 *  A real app points this at a file, e.g. DB_PATH=./app.db. Tests inject their
 *  own `:memory:` handle via setDb() and never read this. */
export const DB_PATH = process.env.DB_PATH ?? ':memory:';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

function readLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL ?? 'info';
  if (!(LOG_LEVELS as readonly string[]).includes(raw)) {
    console.error(`[config] invalid LOG_LEVEL="${raw}" — expected one of ${LOG_LEVELS.join('|')}`);
    process.exit(1);
  }
  return raw as LogLevel;
}

/** Minimum level lib/logger.ts emits. Default 'info' (debug is dev-opt-in). */
export const LOG_LEVEL = readLogLevel();
