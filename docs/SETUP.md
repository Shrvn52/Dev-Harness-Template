# Setup

First-run walkthrough for the harness template. Goal: a green clone in front of you,
then the example domain ripped out and replaced with yours.

---

## Prerequisites

- **Node 22** — pinned in `.nvmrc`. With nvm: `nvm use` (or `nvm install` first).
  The packages declare a supported range of `>=20 <23` and npm `>=10 <12`, but 22 is
  the version the template is developed and CI'd against — use it unless you have a
  reason not to.
- **npm 10+** — ships with Node 22.
- A C toolchain for `better-sqlite3`'s native build. On most Linux/macOS dev machines
  this is already present (build-essential / Xcode CLT); `npm ci` will compile
  the binding.

Verify:

```bash
node --version   # v22.x
npm --version    # 10.x or 11.x
```

---

## Install

This is a **cd-delegation monorepo, not npm workspaces** (see
`docs/ARCHITECTURE.md` → "Why cd-delegation"). Each package owns its own
`node_modules`, so you install in **three** places:

```bash
npm ci                    # root — Playwright, ESLint, typecheck deps
cd backend && npm ci      # Hono, better-sqlite3, zod, tsx, vitest
cd ../frontend && npm ci  # React 19, Vite 6, Tailwind v4, TanStack Query
cd ..
```

`npm ci` does a clean, **reproducible** install from the committed lockfile — what CI
runs, and what the `lockfile-drift` guard protects. Use `npm install <pkg>` only when
you are **intentionally adding or bumping a dependency** (it rewrites the lockfile).

If you intend to run the **UI end-to-end tier**, install the Chromium browser
Playwright drives (one-time, after the root install):

```bash
npx playwright install chromium
```

The always-on API e2e spec does **not** need a browser — only the flag-gated UI spec
does.

---

## Run the dev servers

```bash
npm run dev
```

`tools/dev.mjs` launches **both** dev servers with prefixed, colour-coded output
(`[be]` / `[fe]`), zero extra dependencies. Ctrl-C tears both down.

| Server                         | URL                   | Notes                                           |
| ------------------------------ | --------------------- | ----------------------------------------------- |
| Backend (Hono via `tsx watch`) | http://127.0.0.1:8137 | API under `/api/*`                              |
| Frontend (Vite)                | http://127.0.0.1:5173 | proxies `/api` → backend (see `vite.config.ts`) |

Open **http://127.0.0.1:5173** — the example "Items" surface. Adding an item exercises
the full path: React → `/api` proxy → Hono route → zValidator → SQLite → back.

Run a single side if you prefer:

```bash
npm run dev:backend    # backend only — tsx watch on :8137
npm run dev:frontend   # frontend only — Vite on :5173
```

Override the backend port with `PORT` (the frontend proxy and Playwright both read it):

```bash
PORT=9000 npm run dev:backend
```

By default the backend runs against an **in-memory** SQLite DB (`DB_PATH=:memory:`),
so it resets each restart and leaves no file artifact. Point it at a real file when
you want persistence:

```bash
DB_PATH=./app.db npm run dev:backend
```

---

## Run the tests

Four tiers, fastest first. Each is independently runnable.

```bash
npm test                  # unit + integration + arch (backend) THEN frontend (jsdom)
npm run test:backend      # backend Vitest only — tests/unit, tests/integration, tests/arch + src/**
npm run test:frontend     # frontend Vitest only — jsdom, src/**/*.test.tsx
npm run test:integration  # the integration tier in isolation (real app, in-memory DB)
```

What each tier is:

- **Unit** (`tests/unit/`) — pure functions, no I/O. The fastest, most numerous tier.
- **Integration** (`tests/integration/`) — drives the **real** Hono app via
  `buildApp()` with an in-memory DB injected through `setDb()`, over real HTTP. Mocks
  the subprocess layer via `mock-exec.ts`. Catches route/schema/wiring bugs.
- **Arch** (`tests/arch/`) — four guardrail archetypes (route-registry coverage,
  no-duplicate-shared-exports, forbidden-token allowlist, shrink-only eslint-disable
  ratchet). These are structural invariants, not behavior.
- **Frontend** (`frontend/src/**/*.test.tsx`) — jsdom, Testing Library, renders the
  real `App` through real providers.

End-to-end (Playwright):

```bash
npx playwright test        # always-on API spec only (boots backend with tsx, no browser/UI)
npm run build              # REQUIRED before the UI tier — builds the frontend dist
npm run test:ui            # UI spec too (sets CC_INTEGRATION=1; serves dist via vite preview on :4173)
```

The UI tier is gated behind `CC_INTEGRATION=1` because it needs a **built** frontend
served by `vite preview` — `npm run test:ui` sets the flag for you, but you must
`npm run build` first or `vite preview` has nothing to serve.

> Lint with `npm run lint` (ESLint across the repo) and full-build-check with
> `npm run build` (frontend `tsc && vite build`, then backend `tsc`).
> See `docs/ARCHITECTURE.md` and `TESTING.md` for what these tiers do **not** cover
> (real subprocess, real DB-file migrations, real external APIs).

---

## First real step: delete the example, pour your own in

The `items` domain exists only to prove the wiring is green end-to-end. Replacing it
is the intended first move. The example threads through these files — rename or rip
out each in turn, and the tests/lint/build will tell you when you've missed one:

| Layer               | File(s)                                                                                                | What to do                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Shared types        | `shared/types.ts`                                                                                      | Replace `ItemRow` / `Item` / `rowToItem` with your row + DTO + mapper. Keep the snake_case-row / camelCase-DTO split.                |
| Shared constants    | `shared/constants.ts`                                                                                  | Swap `ITEM_SORT_FIELDS` etc. for yours (keep the const-array-derived-union pattern).                                                 |
| Schema              | `backend/src/schema.ts`                                                                                | Change the `CREATE TABLE` in `runMigrations`. Grow it into a migration registry when needed (see `docs/ARCHITECTURE.md` → "Schema"). |
| Input schemas       | `backend/src/schemas/example.ts`                                                                       | Replace `createItemSchema` with your zod schema(s).                                                                                  |
| Routes              | `backend/src/routes/items.ts`                                                                          | Write your handlers with `createRouter()` + `zValidator`.                                                                            |
| Route registry      | `backend/src/routes/registry.ts`                                                                       | Update `ROUTES` — the SSOT the arch test enforces.                                                                                   |
| Frontend data layer | `frontend/src/api.ts`                                                                                  | Replace the `fetch` wrappers (this is also the offline seam).                                                                        |
| Frontend UI         | `frontend/src/App.tsx`                                                                                 | Replace the example surface.                                                                                                         |
| Tests               | `tests/unit/example.test.ts`, `tests/integration/items.test.ts`, `frontend/src/App.test.tsx`, `e2e/**` | Rewrite against your domain.                                                                                                         |

After replacing, run the full gate to confirm you're green again:

```bash
npm run lint && npm run build && npm test
```

Keep the `lib/`, `config.ts`, `db.ts`, `index.ts`, `tools/dev.mjs`, the arch tests,
and the three-place alias configs — that's the harness. Everything labeled
"example" is yours to discard.
