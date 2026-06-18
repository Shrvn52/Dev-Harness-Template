import type { Context } from 'hono';

/**
 * Shared validation hook for @hono/zod-validator. On failure returns the
 * converged `{ error: string }` shape with 400, instead of zod's default body.
 *
 * Usage: `zValidator('json', someSchema, zodErrorHook)`.
 */
export function zodErrorHook(
  result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } },
  c: Context,
) {
  if (!result.success) {
    const messages = result.error!.issues.map((i) => `${i.path.map(String).join('.')}: ${i.message}`);
    return c.json({ error: messages.join('; ') }, 400);
  }
}
