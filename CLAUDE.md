# CLAUDE.md

Engineering single-source-of-truth for agents working in this repo. This file owns
**WHY** and **DON'T**. It is the first thing to read and the last word on conventions.

> **The one discipline:** make the right thing mechanical and the wrong thing
> impossible to merge. Every convention below is either enforced by a lint selector
> / arch test / typed-error mapper (a CI failure, never a review nit), or documented
> here with its failure mode and an explicit "do not".

## What this is

A working-but-minimal TypeScript monorepo that exists to carry the _harness_, not a
product. The shipped `items` domain (one table, one route group, one page) is an
**example to delete** — replace it with your own. The value is the wiring: green
guardrails an agent inherits and copies.

## Code-map boundary — what this file owns vs what to look up

| Question                                          | Source                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Who calls X · what depends on Y · where is Z used | grep / your editor's LSP (or an optional code-graph tool) — **not** this file |
| Function signatures, source locations             | the code                                                                      |
| **Why** a decision was made                       | this file → _Key Design Decisions_                                            |
| Load-bearing constraints, "do not casually edit"  | this file (inline **DON'T** markers)                                          |
| Env var defaults + rationale                      | this file → _Environment variables_ (mirrored to `.env.example`)              |
| Conventions + how each is enforced                | this file → _Conventions_                                                     |
| Architecture detail, the import/seam decisions    | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                |
| Test tiers + what they don't cover                | [`docs/TESTING.md`](docs/TESTING.md)                                          |

Keep WHAT/WHERE out of this file — it drifts. Keep WHY/DON'T _in_ it — code can't
express intent.

## Development commands

Run from the repo root. (cd-delegation monorepo — root scripts shell into the tiers.)

| Command                    | Does                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Backend (`:8137`) + frontend (`:5173`) together (`tools/dev.mjs`, zero-dep).                                                                                    |
| `npm run build`            | Frontend (`tsc` + vite) then backend (`tsc` → `backend/dist/`).                                                                                                 |
| `npm start`                | Run the built backend (`node dist/backend/src/index.js`).                                                                                                       |
| `npm run lint`             | `eslint .` — the mechanical conventions.                                                                                                                        |
| `npm run typecheck`        | Tests-inclusive type gate — `tsc --noEmit` over `tests/` + `shared` + `backend/src` and the frontend test surface (Vitest's esbuild never type-checks).         |
| `npm test`                 | Node tiers (unit + integration + arch) then the frontend jsdom tier.                                                                                            |
| `npm run test:integration` | API integration tier only.                                                                                                                                      |
| `npm run test:smoke:dist`  | Boot the built `backend/dist` artifact under real Node ESM and hit `/api/health` + `POST /api/items` (needs `npm run build` first; zero-dep `tools/smoke.mjs`). |
| `npm run test:ui`          | Playwright UI E2E (needs a built frontend + `npx playwright install chromium`).                                                                                 |

This table is the SSOT for "the one right command". It must match `package.json`
scripts exactly — the docs-audit skill checks for drift.

## Tech stack

| Layer    | Choice                                                                           |
| -------- | -------------------------------------------------------------------------------- |
| Backend  | Hono + `@hono/node-server`, better-sqlite3, Zod, run via `tsx` / built via `tsc` |
| Frontend | React 19 + Vite 6 + TailwindCSS v4 + TanStack Query                              |
| Shared   | Plain `.ts` (no build step) consumed across the boundary                         |
| Tests    | Vitest (unit/integration/arch + jsdom) + Playwright (E2E)                        |
| Lint     | ESLint flat config + `@typescript-eslint`                                        |

## Architecture

- **`buildApp()` is a pure factory** (`backend/src/index.ts`). No DB open, no timers,
  no port bind at construct time. **DON'T** add side effects to it — the integration
  tier depends on building the real app cheaply and serving it on demand.
- **`setDb()` is the test seam** (`backend/src/db.ts`). It injects an in-memory DB.
  **DON'T** add production callers — it has no runtime guard by design.
- **The route registry is the SSOT for mounted routes** (`backend/src/routes/registry.ts`).
  Add a route by appending one entry; the `registry-coverage` arch test enforces it.
- **Shared types cross the boundary via two import styles, on purpose.** Backend imports
  `shared/` with **relative** paths (`../../../shared/types.js`); frontend imports via the
  **`@shared`** alias. **Why:** `tsc` emits backend under `backend/dist/backend/src` +
  `backend/dist/shared` (so `backend/package.json`'s `type:module` applies) and does
  **not** rewrite path aliases in emit — relative imports are what resolve at runtime.
  The frontend is bundled by Vite, which honours the alias. The `@shared` alias must be
  declared in **three** resolvers (`frontend/tsconfig.json`, `frontend/vite.config.ts`,
  `frontend/vitest.config.ts`) — miss one and imports break in some contexts only.
  **DON'T** delete `shared/package.json` (`{"type":"module"}`): the backend builds under
  `nodenext`, which decides a file's emit format from the _source's_ governing
  `package.json`. `shared/*.ts` falls under the **root** `package.json` (no `type:module`),
  so without this marker tsc emits `shared/` as **CommonJS** and the ESM backend's
  `import { rowToItem }` crashes at `npm start` with "does not provide an export" — a break
  every compile-time gate passes and only `npm run test:smoke:dist` catches.
- **Errors flow through one mapper.** Throw a typed error from `backend/src/lib/errors.ts`;
  `routeErrorHandler` (attached by `createRouter()`) maps it to `{ error: string }` + the
  right status. **DON'T** `throw new Error()` in `backend/src` — a lint selector blocks it.

## Environment variables

Resolved in one place: `backend/src/config.ts` (fail-loud on an invalid `PORT`).
Mirror this table in `.env.example`.

| Var       | Default     | Purpose                                                                                                                        |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `PORT`    | `8137`      | Backend HTTP port. Boot crashes on a non-integer / out-of-range value.                                                         |
| `HOST`    | `127.0.0.1` | Bind address.                                                                                                                  |
| `DB_PATH` | `:memory:`  | SQLite location. In-memory by default (no file artifact); point at a file to persist. Tests inject their own DB via `setDb()`. |

## Key Design Decisions

Canonical format — **SSOT file · the invariant · the failure mode if violated · DON'T**.

- **Typed errors are the only throw in `backend/src`.** SSOT: `lib/errors.ts` +
  `lib/route-error-handler.ts`. Invariant: services/routes throw `AppError` subclasses;
  the handler maps them to `{ error }` + status. Failure mode: a plain `throw new Error()`
  reaches `onError` as a 500 and bypasses status mapping. **DON'T** hand-roll
  `try/catch → c.json` in handlers — throw a typed error. (Enforced: `no-restricted-syntax`.)
- **Mutation input is validated by Zod, never hand-parsed.** SSOT: `backend/src/schemas/`
  - `lib/zod-hook.ts`. Invariant: routes use `zValidator('json', schema, zodErrorHook)` +
    `c.req.valid('json')`. Failure mode: hand-rolled `await c.req.json()` drifts (different
    error shape, shallower validation, untyped body). **DON'T** parse bodies by hand.
- **A name crossing the shared boundary has one home.** SSOT: `shared/`. Invariant: no
  identifier exported from `shared/` is re-declared in `backend/src` or `frontend/src`.
  Failure mode: two definitions drift silently. **DON'T** copy a shared type — import it
  (or `export { X } from '@shared/...'`). (Enforced: `no-duplicate-shared-exports`.)
- **SQL-row types are snake_case; DTOs are camelCase.** SSOT: `shared/types.ts`
  (`ItemRow` vs `Item`). Invariant: row types mirror columns; API types are assembled in
  TS. **DON'T** "fix" `created_at` to `createdAt` on a row type — the split is intentional.
- **Debt only shrinks.** SSOT: `tests/arch/ratchet-allowlist.test.ts`. Invariant: the set
  of files carrying an `eslint-disable` equals the allowlist; it may shrink (clean a file)
  but never grow (silence a new disable). **DON'T** append to the allowlist to quiet lint —
  fix the issue, or document a genuine exception inline with a rationale.

## Conventions

Three tiers. Drift in tier 1 is a CI failure, not a review nit.

**1 — Enforced mechanically** (lint selector or arch test):

| Convention                                                      | Enforced by                                      |
| --------------------------------------------------------------- | ------------------------------------------------ |
| No `throw new Error()` in `backend/src` (use typed errors)      | `eslint.config.mjs` — `no-restricted-syntax`     |
| Node built-ins use the `node:` prefix                           | `eslint.config.mjs` — `no-restricted-imports`    |
| No `console.*` in `backend/src` (except the boot path)          | `eslint.config.mjs` — `no-console`               |
| No re-declaring a `shared/` export                              | `tests/arch/no-duplicate-shared-exports.test.ts` |
| Every registry route has a backing router + unique `/api/` path | `tests/arch/registry-coverage.test.ts`           |
| `eslint-disable` count only shrinks                             | `tests/arch/ratchet-allowlist.test.ts`           |
| No `FIXME` markers outside the allowlist                        | `tests/arch/forbidden-token.test.ts`             |

**2 — Documented exceptions** (must carry an inline `eslint-disable` + rationale):

- `backend/src/lib/route-error-handler.ts` uses `console.error` for the unknown-error
  fallback — the one allow-listed `eslint-disable` (and the anchor of the ratchet test).

**3 — Prose, promote on next leak** (not yet mechanical — make it tier 1 when it recurs):

- Mutation success is `{ ok: true }`; failure is `{ error: string }` + status. No `{ message }`.
- `localStorage`/magic-number keys are named constants, declared once.

**The promotion loop:** when a review finding recurs, encode it as the smallest AST
fingerprint in `eslint.config.mjs` (see the worked `no-restricted-syntax` selector) or
as a `tests/arch/` fitness test. The goal: review only ever does genuine judgment work.

## The committed `.claude/` harness

`.claude/` is committed so every clone and worktree subagent inherits it:

- **`settings.json`** — a `PostToolUse` hook runs `hooks/post-edit-lint.sh` on each
  edited TS file (exit 2 surfaces lint errors so the model self-fixes) + a minimal safe
  permission baseline. Machine-specific perms go in `settings.local.json` (gitignored;
  see `settings.local.json.example`).
- **`agents/`** — `silent-failure-hunter`, `pr-test-analyzer`, `code-simplifier` review
  subagents. **`commands/`** — `/validate` (mirrors CI lanes) and `/review-pr`
  (fresh-context: the session that wrote code must not review it). **`skills/docs-audit/`**
  — the doc-drift loop.

## Workflow rules

- **Rebuild after changing code.** `npm run build` (or the per-tier build) before
  claiming a change works — `dist/` is stale otherwise.
- **`/validate` is a dispatcher, not an inline checker.** It runs the same scripts CI
  runs. Don't re-inline check logic.
- **`.archon/` is optional.** It needs the external Archon CLI. Delete the directory if
  you don't use it — nothing in the app reads it.

## Plans — search hygiene

Plans live in `plans/`, committed to git.

- The repo root has a `.ignore` containing `archive/`, so ripgrep (and the Grep tool)
  auto-skip any `archive/` dir at any depth. **Caveat:** glob does _not_ respect
  `.ignore` — filter `archive/` out of glob results yourself; never read a file under
  `archive/` unless explicitly named.
- Completing a plan: `git mv plans/foo.md plans/archive/`. New plans go in `plans/` with
  a `YYYY-MM-DD-slug.md` prefix, never inside `archive/`.

## No time estimates

Never give time-unit estimates (min/hr/day/week). Use weight tiers: **trivial** (a
comment, 1 file) · **small** (1 fn, 1–2 files) · **medium** (multi-fn, 2–4 files, new
tests) · **large** (cross-layer, 5+ files) · **epic** (multi-PR). Tool weight must match
the tier — don't reach for heavy multi-agent automation on a trivial change.
