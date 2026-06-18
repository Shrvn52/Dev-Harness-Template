import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from './errors.js';

/**
 * Hono onError handler — converges every thrown error to one wire shape:
 * `{ error: string }` + the right HTTP status. Attached by `createRouter()`.
 *
 * AppError subclasses carry their own status. HTTPException (duck-typed to dodge
 * CJS/ESM `instanceof` mismatch) passes its status through. Everything else → 500.
 */

function isHTTPException(err: unknown): err is { status: number; message: string; getResponse: () => Response } {
  if (err === null || typeof err !== 'object') return false;
  const e = err as { status?: unknown; getResponse?: unknown };
  return typeof e.status === 'number' && typeof e.getResponse === 'function';
}

export function routeErrorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.status);
  }
  if (isHTTPException(err)) {
    return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  }
  // Unknown error — log the stack for diagnosis, never leak internals to the client.
  // eslint-disable-next-line no-console -- unknown-error fallback diagnostic; this file is the documented exception (CLAUDE.md → Conventions) and the sole allow-listed entry in tests/arch/ratchet-allowlist.test.ts
  console.error('[unhandled]', err.stack ?? err.message);
  return c.json({ error: 'Internal server error' }, 500);
}
