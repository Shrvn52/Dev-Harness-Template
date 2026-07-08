---
description: Guided adoption — replace the items example with the user's domain, gate-verified.
---

# Start — replace the example with the user's domain

You are walking the adopter through the template's intended first move: deleting
the `items` example and pouring their domain in, with the gate green at both ends.
Read `CLAUDE.md` first if you haven't — it is the last word on conventions.

## 0. Prove the baseline

Run `npm run gate`. If it fails on a fresh clone, STOP and diagnose before touching
anything — the whole point of the swap is green-to-green. (`npm ci` first if
node_modules is missing.)

## 1. Collect the domain

Ask the user (one question set, not a drip-feed):

1. **Entity name** — singular + plural (e.g. `note` / `notes`). Kebab/lowercase.
2. **Fields** — name, type (string/number/boolean/ISO date), required?, for each.
   `id` and `created_at` come free; recommend keeping them.
3. **First UI surface** — list + create form (like the example), or list-only?

Don't ask about auth, pagination, or extra routes — day-2 scope; say so if raised.

## 2. Replace, in dependency order

Work through the layers in this order, running the post-edit lint feedback as you
go. Keep the conventions the arch tests enforce (they will tell you if you don't):
snake_case row types vs camelCase DTOs, `createRouter()` for routers, `zValidator`
for every mutation body, registry entry per route file.

| Layer         | File                                                                                                   | Action                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Shared types  | `shared/types.ts`                                                                                      | `<Entity>Row` (snake_case) + `<Entity>` DTO + `rowTo<Entity>()` |
| Schema        | `backend/src/schema.ts`                                                                                | CREATE TABLE for the new entity                                 |
| Input schemas | `backend/src/schemas/example.ts` → rename                                                              | zod create/update/param schemas                                 |
| Routes        | `backend/src/routes/items.ts` → rename                                                                 | CRUD handlers via `createRouter()` + `zValidator`               |
| Registry      | `backend/src/routes/registry.ts`                                                                       | swap the `/api/items` entry for the new path                    |
| Frontend data | `frontend/src/api.ts`                                                                                  | fetch wrappers typed against the new DTO                        |
| Frontend UI   | `frontend/src/App.tsx`                                                                                 | the new surface                                                 |
| Tests         | `tests/unit/example.test.ts`, `tests/integration/items.test.ts`, `frontend/src/App.test.tsx`, `e2e/**` | rewrite against the new domain — keep the _shape_ of each tier  |

Then sweep: `grep -ri "\bitems\?\b" --include="*.ts" --include="*.tsx" backend frontend shared tests e2e`
and clean any straggler (docs mentioning the example are fine to leave; SETUP.md
describes it as the example by name).

## 3. Gate out

Run `npm run gate` until green. It is the same script chain CI runs — including the
domain-neutral dist smoke — so green here IS green in CI. If the UI flow matters to
the user, also: `npx playwright install chromium && npm run test:ui`.

## 4. Hand back

Summarize: what was renamed, which conventions the new code follows, and point at
`START_HERE.md` §4 (what the template deliberately does NOT do) for their day-2
planning. Suggest committing on a branch and letting CI confirm the parity claim.
