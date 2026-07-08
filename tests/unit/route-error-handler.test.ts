import { describe, it, expect, vi } from 'vitest';
import type { Context } from 'hono';
import { routeErrorHandler } from '../../backend/src/lib/route-error-handler.js';
import { ConflictError } from '../../backend/src/lib/errors.js';
import { logger } from '../../backend/src/lib/logger.js';

// Unit tier — the typed-error mapper has three branches; only the AppError path is
// exercised end-to-end (the 404 in items.test.ts). Here we hit all three directly,
// including the security-relevant unknown→500 no-leak fallback, via a minimal mock
// Context: the handler only ever calls `c.json(body, status)`.
function mockContext(): { c: Context; calls: Array<{ body: unknown; status: number }> } {
  const calls: Array<{ body: unknown; status: number }> = [];
  const c = {
    json: (body: unknown, status: number) => {
      calls.push({ body, status });
      return { body, status };
    },
  } as unknown as Context;
  return { c, calls };
}

describe('routeErrorHandler', () => {
  it('maps an unknown error to 500 with no leak of the message', () => {
    const { c, calls } = mockContext();
    // Spy the logger: asserts the stack IS captured server-side, and keeps the
    // intentional "secret /path/leak" fixture out of the test run's stderr.
    const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      routeErrorHandler(new Error('secret /path/leak'), c);
      expect(calls).toHaveLength(1);
      expect(calls[0].status).toBe(500);
      // Exact body — proves the internal message never reaches the client.
      expect(calls[0].body).toEqual({ error: 'Internal server error' });
      // ...while the diagnostic detail still lands in the server log.
      expect(logSpy).toHaveBeenCalledOnce();
      expect(String(logSpy.mock.calls[0][1]?.stack)).toContain('secret /path/leak');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('passes through an HTTPException-shaped error status', () => {
    const { c, calls } = mockContext();
    const httpException = {
      status: 418,
      message: "I'm a teapot",
      getResponse: () => new Response(null, { status: 418 }),
    };
    routeErrorHandler(httpException as unknown as Error, c);
    expect(calls[0].status).toBe(418);
    expect(calls[0].body).toEqual({ error: "I'm a teapot" });
  });

  it('maps an AppError subclass to its own status and message', () => {
    const { c, calls } = mockContext();
    routeErrorHandler(new ConflictError('dup'), c);
    expect(calls[0].status).toBe(409);
    expect(calls[0].body).toEqual({ error: 'dup' });
  });
});
