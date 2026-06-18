import { z } from 'zod';

/**
 * Mutation input schemas live in `backend/src/schemas/`. Routes validate via
 * `zValidator('json', schema, zodErrorHook)` and read the body with
 * `c.req.valid('json')` — never a hand-rolled `await c.req.json()`.
 */

/** Create-item input. */
export const createItemSchema = z.object({
  title: z.string().min(1).max(200),
});

/** Update-item input — derived from create via `.partial()`. One schema is the
 *  source; the update DTO is its partial, so they can't drift. */
export const updateItemSchema = createItemSchema.partial();

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
