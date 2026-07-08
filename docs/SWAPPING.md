# Swapping a stack layer

The template is **opinionated about the harness, neutral about the stack**. This doc
is the map for the person who wants Postgres instead of SQLite, Express instead of
Hono, or a different frontend entirely — which files are the harness you keep, which
are the stack you replace, and what each guardrail needs re-pointed after the swap.

(Replacing just the `items` _domain_ while keeping the stack is a smaller operation —
see [`SETUP.md`](SETUP.md) → "First real step".)

---

## Harness vs stack — the inventory

**Harness — survives any stack swap** (adapt names, keep the mechanism):

| Piece                                              | Why it survives                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CLAUDE.md` + the docs                             | WHY/DON'T is stack-independent; update the tables it owns after a swap.                 |
| `tests/arch/` (all four archetypes)                | Fitness tests over _your source files_ — they read the filesystem, not the framework.   |
| `eslint.config.mjs`                                | The promotion-loop home. Selectors reference _your_ canonical fixes; the shape carries. |
| `.claude/` (hook, agents, commands, skills)        | Tooling-level, framework-blind. The post-edit hook runs eslint on any TS file.          |
| `.github/workflows/` (lanes, filters, secret scan) | Update path filters if you rename dirs; the lane structure and drift guards carry.      |
| `tools/dev.mjs` + `tools/smoke.mjs`                | Zero-dep spawn wrappers. Smoke needs its two probe URLs re-pointed (see below).         |
| `shared/` + the two-import-style convention        | Any TS front/back split has this boundary. Keep `shared/package.json` (`type: module`). |
| The test taxonomy (unit/integration/arch/e2e)      | Tier boundaries and "what each tier doesn't cover" are stack-free ideas.                |

**Stack — replace wholesale, don't abstract:**

| Piece                                                                                                 | Replaced when you swap…      |
| ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| `backend/src/db.ts`, `schema.ts`                                                                      | the database                 |
| `backend/src/index.ts`, `lib/hono-app.ts`, `lib/zod-hook.ts`, `lib/route-error-handler.ts`, `routes/` | the HTTP framework           |
| `frontend/src/**`, `vite.config.ts`, Tailwind config                                                  | the frontend                 |
| `e2e/**`, `playwright.config.ts` webServer commands                                                   | either server's boot command |

---

## Swap the database (better-sqlite3 → Postgres, libsql, …)

1. Replace `db.ts` — keep its **shape**: a lazy `getDb()`, a `closeDb()`, and the
   `setDb()` **test seam**. The seam is the load-bearing part: the integration tier
   injects a throwaway DB through it (`tests/integration/_helpers/test-app.ts`).
   For a server DB, `setDb()` injects a pool pointed at a per-test schema or a
   Testcontainers instance instead of an in-memory handle.
2. Replace `schema.ts` (`runMigrations`) with your migration story.
3. Update `shared/types.ts` row types — keep the snake_case-row / camelCase-DTO
   split; it's a convention about SQL↔wire boundaries, not about SQLite.
4. Re-point config: `DB_PATH` becomes `DATABASE_URL` in `backend/src/config.ts`;
   mirror the change in `.env.example` **and** CLAUDE.md's env table.
5. Guardrails touched: `backend/vitest.config.ts` — remove `better-sqlite3` from
   `server.deps.external` (or swap in your new native dep). Nothing in `tests/arch/`
   knows the DB exists.

## Swap the HTTP framework (Hono → Express, Fastify, …)

1. Keep the two **factory invariants**, whatever the framework:
   - `buildApp()` stays **pure** — no DB open, no port bind, no timers at construct
     time. This is what makes the integration tier cheap.
   - The **route registry** (`routes/registry.ts`) stays the SSOT for mounted routes.
     `tests/arch/registry-coverage.test.ts` only needs its `r.app.fetch` duck-type
     check swapped for your framework's router type.
2. Re-implement the **one error mapper**: typed errors in `lib/errors.ts` are
   framework-free already; `route-error-handler.ts` becomes your framework's error
   middleware. Keep the `no-restricted-syntax` lint selector — only its _message_
   names Hono-specific plumbing.
3. Re-implement input validation as your framework's Zod hook (the invariant is
   "mutation input is validated by Zod, never hand-parsed", not "use zValidator").
4. Re-point the boot probes: `tools/smoke.mjs` hits `/api/health` + `POST /api/items`
   on the built artifact; `playwright.config.ts` boots the dev entry.
5. The NodeNext emit constraints (relative `shared/` imports with `.js` extensions,
   `shared/package.json`) are about **tsc**, not Hono — they carry unchanged.

## Swap the frontend

1. `frontend/` is self-contained — replace it wholesale. The backend knows nothing
   about it (the dev-time `/api` proxy lives in `vite.config.ts`).
2. Keep the `@shared` alias idea; declare it in your new toolchain's resolvers (the
   "three places" gotcha in `ARCHITECTURE.md` generalizes: _every_ resolver that sees
   the import needs the alias).
3. Guardrails touched: the `no-duplicate-shared-exports` arch test scans
   `frontend/src` by path — update the path if you rename the dir; the eslint
   frontend block and CI `frontend`/`e2e` path filters likewise.

---

## After any swap

Run the full gate and the docs-audit skill — a layer swap is exactly the kind of
change that strands WHAT/WHERE claims in the docs:

```bash
npm ci && npm run lint && npm run format:check && npm run typecheck && npm run build \
  && npm test && npm run test:smoke:dist && npx playwright test
```
