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
**example to delete** — replace it with your own (see `START_HERE.md` / `/start`).
The value is the wiring: green guardrails an agent inherits and copies.

## Code-map boundary — what this file owns vs what to look up

| Question                                          | Source                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Who calls X · what depends on Y · where is Z used | grep / your editor's LSP (or an optional code-graph tool) — **not** this file |
| Function signatures, source locations             | the code                                                                      |
| What commands exist + what they run               | `package.json` `scripts` — **not** this file                                  |
| **Why** a decision was made                       | this file → _Key Design Decisions_                                            |
| Load-bearing constraints, "do not casually edit"  | this file (inline **DON'T** markers)                                          |
| Env var defaults + rationale                      | this file → _Environment variables_ (mirror enforced by an arch test)         |
| Conventions + how each is enforced                | this file → _Conventions_                                                     |
| Architecture detail, the import/seam decisions    | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                |
| Test tiers + what they don't cover                | [`docs/TESTING.md`](docs/TESTING.md)                                          |
| Swap a stack layer (DB / framework / frontend)    | [`docs/SWAPPING.md`](docs/SWAPPING.md)                                        |
| Keep pinned things fresh (deps, Node, gitleaks)   | [`docs/SETUP.md`](docs/SETUP.md) → _Keeping the template fresh_               |

Keep WHAT/WHERE out of this file — it drifts. Keep WHY/DON'T _in_ it — code can't
express intent. (Docs POINT at code; they don't mirror it. The one deliberate
mirror — the env table below — is pinned to `config.ts` by
`tests/arch/env-vars.test.ts`, so its drift is a CI failure. Corollary: never
state COUNTS of code artifacts in prose — "the five arch tests" rots the moment
someone adds a sixth; name the directory instead.)

## Development commands

`package.json` `scripts` is the SSOT — read it, don't memorize it. The ones that
matter daily:

- **`npm run gate`** — THE definition of green: format:check → lint → typecheck →
  build → test → built-artifact smoke. CI runs these same scripts; a local gate
  pass means CI-parity. Run it before claiming any change works.
- **`npm run dev`** — backend (`:8137`) + frontend (`:5173`) together
  (`tools/dev.mjs`, zero-dep).
- **`npm test` / `npm run test:integration` / `npm run test:ui`** — the tiers, see
  [`docs/TESTING.md`](docs/TESTING.md).

(npm-workspaces monorepo — ONE `npm ci` at the root installs every tier.)

## Tech stack

| Layer    | Choice                                                                             |
| -------- | ---------------------------------------------------------------------------------- |
| Backend  | Hono + `@hono/node-server`, better-sqlite3, Zod, run via `tsx` / built via `tsc`   |
| Frontend | React 19 + Vite 6 + TailwindCSS v4 + TanStack Query                                |
| Shared   | Plain `.ts` (no build step) consumed across the boundary                           |
| Tests    | Vitest (unit/integration/arch + jsdom) + Playwright (E2E)                          |
| Lint     | ESLint flat config + `@typescript-eslint`; prettier for formatting (CI-enforced)   |
| Ship     | `npm run build && npm start` serves API + built frontend on one port; `Dockerfile` |

## Architecture

- **`buildApp()` is a pure factory** (`backend/src/index.ts`). No DB open, no timers,
  no port bind at construct time. **DON'T** add side effects to it — the integration
  tier depends on building the real app cheaply and serving it on demand. Boot-time
  side effects (eager DB open, static-file mounting) belong in `startServer()`.
- **`setDb()` is the test seam** (`backend/src/db.ts`). It injects an in-memory DB.
  **DON'T** add production callers — there is no runtime guard by design; the fence
  is `tests/arch/setdb-seam.test.ts`, which fails on any runtime-source reference
  outside `db.ts`.
- **The route registry is the SSOT for mounted routes** (`backend/src/routes/registry.ts`).
  Add a route by appending one entry; the `registry-coverage` arch test enforces it
  (recursively — a router in a `routes/` subdirectory must be registered too).
- **Shared types cross the boundary via RELATIVE imports on both sides.** Backend:
  `../../shared/types.js` (NodeNext ESM needs the `.js`); frontend: `../../shared/types`
  (bundler resolution, extensionless). **Why no alias:** an alias must be declared in
  every resolver that ever touches the import, and each declaration is a place to
  drift — relative paths resolve identically everywhere for free.
  **DON'T** delete `shared/package.json` (`{"type":"module"}`): the backend builds under
  `nodenext`, which decides a file's emit format from the _source's_ governing
  `package.json`. `shared/*.ts` falls under the **root** `package.json` (no `type:module`),
  so without this marker tsc emits `shared/` as **CommonJS** and the ESM backend's
  import of it crashes at `npm start` with "does not provide an export" — a break
  every compile-time gate passes and only `npm run test:smoke:dist` catches (it
  imports every emitted `dist/shared` module for exactly this reason).
- **Errors flow through one mapper.** Throw a typed error from `backend/src/lib/errors.ts`;
  `routeErrorHandler` (attached by `createRouter()`) maps it to `{ error: string }` + the
  right status; `buildApp()`'s `notFound` keeps unknown paths on the same JSON shape.
  **DON'T** throw built-in error constructors in `backend/src` — a lint selector blocks
  both `throw new Error()` and `throw Error()`.
- **The ship path is deliberately minimal.** `startServer()` serves `frontend/dist`
  (SPA fallback excludes `/api/*`) when a build exists; the `Dockerfile` is the whole
  deploy story. **DON'T** grow orchestration in here — compose files, TLS, CDNs are
  the adopter's day-2 decisions, not template surface.

## Environment variables

Resolved in one place: `backend/src/config.ts` — fail-loud at boot on an invalid
value (and `startServer()` opens the DB eagerly so a broken `DB_PATH` crashes boot
instead of 500ing per-request behind a healthy healthcheck). This table and
`.env.example` are deliberate mirrors of `config.ts`, pinned by
`tests/arch/env-vars.test.ts`.

| Var         | Default     | Purpose                                                                                                                                                                                                                                                                                                                                |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`      | `8137`      | Backend HTTP port. Boot crashes on a non-integer / out-of-range value. Read by the backend, the Vite dev/preview proxy, and Playwright.                                                                                                                                                                                                |
| `HOST`      | `127.0.0.1` | Bind address (the `Dockerfile` sets `0.0.0.0`).                                                                                                                                                                                                                                                                                        |
| `DB_PATH`   | `:memory:`  | SQLite location. In-memory by default (no file artifact); point at a file to persist. Tests inject their own DB via `setDb()`. **Caveat:** under `npm run dev` (tsx watch), every file save restarts the process and **wipes the in-memory DB** — deliberate, see `docs/SETUP.md`; use `DB_PATH=./dev.db` for save-surviving dev data. |
| `LOG_LEVEL` | `info`      | Minimum level `lib/logger.ts` emits (`debug`\|`info`\|`warn`\|`error`). Boot crashes on any other value.                                                                                                                                                                                                                               |

## Key Design Decisions

Canonical format — **SSOT file · the invariant · the failure mode if violated · DON'T**.

- **Typed errors are the only throw in `backend/src`.** SSOT: `lib/errors.ts` +
  `lib/route-error-handler.ts`. Invariant: services/routes throw `AppError` subclasses;
  the handler maps them to `{ error }` + status. Failure mode: a plain built-in error
  reaches `onError` as a 500 and bypasses status mapping. **DON'T** hand-roll
  `try/catch → c.json` in handlers — throw a typed error. (Enforced, precisely: a
  `no-restricted-syntax` selector bans throwing any **built-in** error constructor by
  name — `new Error()` and no-`new` `Error()` alike — and the type-aware
  `only-throw-error` bans throwing non-`Error` values. Known blind spot: aliasing a
  constructor (`const E = Error`) defeats both — the gate catches accidents, not
  deliberate evasion.)
- **Mutation input is validated by Zod, never hand-parsed.** SSOT: `backend/src/schemas/`
  - `lib/zod-hook.ts`. Invariant: routes use `zValidator('json', schema, zodErrorHook)` +
    `c.req.valid('json')`. Failure mode: hand-rolled `await c.req.json()` drifts (different
    error shape, shallower validation, untyped body). **DON'T** parse bodies by hand.
    (Enforced: `tests/arch/route-conventions.test.ts`, which also fences `new Hono()`
    to the `createRouter()` factory + `buildApp()`.)
- **A name crossing the shared boundary has one home.** SSOT: `shared/`. Invariant: no
  identifier exported from `shared/` is re-declared in `backend/src` or `frontend/src`.
  Failure mode: two definitions drift silently. **DON'T** copy a shared type — import it
  (or re-export it). (Enforced: `no-duplicate-shared-exports`.)
- **SQL-row types are snake_case; DTOs are camelCase.** SSOT: `shared/types.ts`
  (`ItemRow` vs `Item`). Invariant: row types mirror columns; API types are assembled in
  TS. **DON'T** "fix" `created_at` to `createdAt` on a row type — the split is intentional.
- **Debt only shrinks — and lint can't be silenced off the books.** SSOT:
  `tests/arch/ratchet-allowlist.test.ts` (+ the inline-config ban in
  `tests/arch/forbidden-token.test.ts`). Invariant: every first-party source file
  carrying `eslint-disable` directives appears in the allowlist with its **exact
  occurrence count**; counts may shrink but never grow, and the allowlist's goal
  state — where this repo lives — is **empty**. `/* eslint rule: "off" */` config
  comments (the untracked silencing channel) are banned outright, and unused disable
  directives are lint errors. **DON'T** append an entry or raise a count to quiet
  lint — fix the issue, or document a genuine exception inline with a rationale.

## Conventions

Four tiers. Drift in tier 1 is a CI failure, not a review nit.

**1 — Enforced mechanically** (lint selector or arch test — the current inventory
lives in `eslint.config.mjs` + `tests/arch/`; highlights):

| Convention                                                      | Enforced by                                      |
| --------------------------------------------------------------- | ------------------------------------------------ |
| No throwing built-in errors in `backend/src` (use typed errors) | `eslint.config.mjs` — `no-restricted-syntax`     |
| Node built-ins use the `node:` prefix                           | `eslint.config.mjs` — `no-restricted-imports`    |
| No `console.*` in `backend/src` — use `lib/logger.ts`           | `eslint.config.mjs` — `no-console`               |
| No inline `/* eslint … */` rule config; no stale disables       | `tests/arch/forbidden-token.test.ts` + lint      |
| No re-declaring a `shared/` export                              | `tests/arch/no-duplicate-shared-exports.test.ts` |
| Every router file is registered; registry paths unique `/api/*` | `tests/arch/registry-coverage.test.ts`           |
| Bodies via `zValidator`; routers via `createRouter()`           | `tests/arch/route-conventions.test.ts`           |
| `setDb()` has no runtime callers outside `db.ts`                | `tests/arch/setdb-seam.test.ts`                  |
| `eslint-disable` count only shrinks (goal state: zero)          | `tests/arch/ratchet-allowlist.test.ts`           |
| No `FIXME` markers outside the allowlist                        | `tests/arch/forbidden-token.test.ts`             |
| Env table + `.env.example` mirror `config.ts`                   | `tests/arch/env-vars.test.ts`                    |
| Formatting is prettier-clean (`.prettierrc`)                    | CI `format` lane — always runs, unfiltered       |

The lint/typecheck/arch perimeter covers ALL first-party source: `backend/src`,
`frontend/src`, `shared`, `tests`, `e2e`, `tools`, and the Playwright config.

**2 — Documented exceptions** (must carry an inline `eslint-disable` + rationale):

- Currently NONE — the ratchet allowlist is empty, which is its goal state. A new
  entry needs a rationale comment at the disable site AND an allowlist entry with
  the exact count (`tests/arch/ratchet-allowlist.test.ts`).

**3 — Review invariants, as data** (rules that can NEVER be mechanical — permanent
judgment calls): they live in `.archon/invariants.yaml`, one row per rule with
`trigger_paths` globs. `/review-pr` loads the file at review time and fans out a
reviewer for the rules a diff actually fires (the Archon workflows automate the
same data). Enforcing a new judgment rule is a one-line append — never hardcode
it into a command or workflow.

**4 — Prose, promote on next leak** (not yet mechanical — make it tier 1 when it recurs,
or tier 3 if it never can be):

- Mutation success returns the affected resource DTO (`201` + the created object,
  `200` + the updated object); failure is `{ error: string }` + status. No `{ message }`,
  no bare `{ ok: true }` bodies.
- `localStorage`/magic-number keys are named constants, declared once (worked
  pattern: `docs/RECIPES.md` → const-array-derived unions).

**The promotion loop:** when a review finding recurs, encode it as the smallest AST
fingerprint in `eslint.config.mjs` (see the worked `no-restricted-syntax` selector) or
as a `tests/arch/` fitness test (see `route-conventions` — born from exactly this loop).
If it can never be mechanical, append it to `.archon/invariants.yaml` instead.
The goal: review only ever does genuine judgment work.

## The committed `.claude/` harness

`.claude/` is committed so every clone and worktree subagent inherits it:

- **`settings.json`** — a `PostToolUse` hook runs `hooks/post-edit-lint.sh` on each
  edited TS file (exit 2 surfaces lint errors so the model self-fixes) + a minimal safe
  permission baseline (read-only git, the gate scripts — deliberately NOT `npm run dev`,
  which never exits). Machine-specific perms go in `settings.local.json` (gitignored;
  see `settings.local.json.example`).
- **`agents/`** — `silent-failure-hunter`, `pr-test-analyzer`, `code-simplifier` review
  subagents (advisory-only: their `tools:` lists exclude Edit/Write). **`commands/`** —
  `/start` (guided example→your-domain adoption), `/validate` (dispatches to
  `npm run gate`), `/review-pr` (fresh-context: the session that wrote code must not
  review it). **`skills/docs-audit/`** — the doc-drift loop for prose claims no arch
  test can check (reports land in `audits/`, gitignored).

`.archon/` is committed for the same reason: `invariants.yaml` is the data file
behind conventions tier 3 (loaded by `/review-pr` — no Archon install needed), and
`workflows/` automates it for operators running the external Archon CLI. **DON'T**
hardcode a judgment rule into a command/workflow prompt — append it to
`invariants.yaml` so every consumer picks it up.

## Workflow rules

- **`npm run gate` before claiming a change works.** It rebuilds, so `dist/` staleness
  can't fool you, and it is CI-parity by construction.
- **`/validate` is a dispatcher, not an inline checker.** It runs the same scripts CI
  runs. Don't re-inline check logic.

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
