# Setup

First-run walkthrough for the harness template. Goal: a green clone in front of you,
then the example domain ripped out and replaced with yours.

---

## Prerequisites

- **Node 22** — pinned in `.nvmrc`. With nvm: `nvm use` (or `nvm install` first).
  The packages declare a floor of `>=20` with **no upper bound** — deliberately, so a
  fresh clone on a future Node major installs instead of hard-failing on an `engines`
  check. `.nvmrc` is the version the template is developed and CI'd against; use it
  unless you have a reason not to.
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

This is an **npm workspaces monorepo** (see `docs/ARCHITECTURE.md` → "Why npm
workspaces") — one lockfile, one install covers root tooling + backend + frontend:

```bash
npm ci    # everything: ESLint/Playwright/prettier + Hono/better-sqlite3 + React/Vite
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

> **⚠️ Dev data does not survive a file save.** The default DB is in-memory
> (`DB_PATH=:memory:`) and the dev backend runs under `tsx watch` — **every source
> save restarts the process and wipes all data**. This is deliberate (a template
> must leave no file artifacts, and tests inject their own DB), but it surprises
> people mid-flow. Want data that survives saves? Point at a file — anything
> matching `*.db` is gitignored:

```bash
DB_PATH=./dev.db npm run dev:backend
```

---

## Run the tests

Fastest first; each independently runnable (`npm run gate` chains them all + the checks).

```bash
npm test                  # unit + integration + arch (backend) THEN frontend (jsdom)
npm run test:backend      # backend Vitest only — tests/unit, tests/integration, tests/arch + src/**
npm run test:frontend     # frontend Vitest only — jsdom, src/**/*.test.tsx
npm run test:integration  # the integration tier in isolation (real app, in-memory DB)
```

What each tier is:

- **Unit** (`tests/unit/`) — pure functions, no I/O. The fastest, most numerous tier.
- **Integration** (`tests/integration/`) — drives the **real** Hono app via
  `buildApp()` with an in-memory DB injected through `setDb()`, over real HTTP.
  Catches route/schema/wiring bugs.
- **Arch** (`tests/arch/`) — the guardrail archetypes (registry coverage, duplicate
  shared exports, the debt ratchet, forbidden tokens, route conventions, env-var
  mirrors, the setDb fence — the directory is the inventory). Structural
  invariants, not behavior.
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
is the intended first move, and it is a GUIDED one: run **`/start`** in Claude Code
(`.claude/commands/start.md`) and the agent walks the whole swap — verify green,
collect your domain, replace each layer in dependency order, finish with the same
gate CI runs. `START_HERE.md` at the repo root is the human-readable version of the
same path.

The example threads through, in dependency order: `shared/types.ts` →
`backend/src/schema.ts` → `backend/src/schemas/example.ts` →
`backend/src/routes/items.ts` → `backend/src/routes/registry.ts` →
`frontend/src/api.ts` → `frontend/src/App.tsx` → the tests that assert it
(`tests/unit/example.test.ts`, `tests/integration/items.test.ts`,
`frontend/src/App.test.tsx`, `e2e/**`). Grep for `item` when you think you're done —
the gate will tell you about anything you missed:

```bash
npm run gate    # format:check → lint → typecheck → build → test → dist smoke
```

`npm run gate` is the SAME script chain CI runs — passing locally means CI-parity
(the dist smoke is domain-neutral, so it survives the deletion by design).

Keep `lib/`, `config.ts`, `db.ts`, `index.ts`, `tools/`, and the arch tests —
that's the harness. Everything labeled "example" is yours to discard. Swapping a
whole _layer_ (the DB, the HTTP framework, the frontend) rather than just the
domain? That's a different operation — see [`SWAPPING.md`](SWAPPING.md).

---

## Ship it

`npm run build && npm start` is a real deployable: the backend serves the built
frontend at `/` (SPA fallback included) and the API under `/api/*`, one port, no
reverse proxy needed to try it. For containers:

```bash
docker build -t my-app .
docker run -p 8137:8137 -v appdata:/data my-app   # DB persists in the volume
```

The `Dockerfile` sets `HOST=0.0.0.0` and `DB_PATH=/data/app.db`. That is the whole
ship story on purpose — TLS, auth, scaling, and error reporting are day-2 decisions
the template must not make for you (`START_HERE.md` lists them explicitly).

---

## Keeping the template fresh

The template deliberately ships **no update bots** (Renovate/Dependabot): a template
is a starting point, not a deployed app, and bot config in a template is a promise
the cloner's org may never honor. Staleness is instead handled by one **documented
routine** — run it quarterly-ish, or whenever the scheduled `Audit` workflow goes red:

1. **Deps** — `npm outdated` at the root (workspaces-aware). Bump what you care
   about with `npm install <pkg>@latest -w <workspace>` (or at root for tooling),
   then run the full gate below.
2. **Node** — check the current LTS. Bump `.nvmrc` (and CI follows automatically —
   every lane reads `node-version-file: .nvmrc`). The `engines` floor (`>=20`)
   only needs raising when you _adopt_ a feature older Node lacks.
3. **Pins** — `.github/workflows/pr.yml` pins TWO things to refresh together with
   their hashes, never version-only: the gitleaks binary (version + sha256 from the
   release's `checksums.txt`) and the `dorny/paths-filter` action (commit SHA — it
   decides which CI lanes run, so verify the SHA against the release tag on its
   repo before bumping).
4. **Prove it** — `npm ci && npm run gate && npx playwright test`

The scheduled `Audit` workflow (Mondays, `audit.yml`) is the alarm between routine
runs — it fails on any high-severity advisory in the lockfile, which is your cue to
run step 1 early.
