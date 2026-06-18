# Testing

Four tiers, all green on a fresh clone. Each catches a different class of bug; the
table says which command runs it and what it can and can't see.

| Tier | Location | Command | Runner | Catches |
|------|----------|---------|--------|---------|
| **Unit** | `tests/unit/` | `npm test` | Vitest (node) | Pure-function logic. Fast, numerous. |
| **Integration** | `tests/integration/` | `npm run test:integration` | Vitest (node) | Route + schema + wiring bugs, against the **real** app via `buildApp()` + an in-memory DB via `setDb()`. |
| **Arch** | `tests/arch/` | `npm test` | Vitest (node) | Architecture drift — executable fitness functions (duplicate shared exports, registry coverage, the debt ratchet, forbidden tokens). |
| **E2E** | `e2e/` | `npm run test:ui` / `npx playwright test` | Playwright | The real frontend in a real browser + the real server over HTTP. |

`npm test` runs unit + integration + arch (the node tiers) for backend, then the
jsdom tier for frontend. The two E2E commands are separate because they boot real
servers (and the UI lane needs a built frontend + `npx playwright install chromium`).

## The seams that make integration tests real, not mock theatre

- **`buildApp()`** (`backend/src/index.ts`) is a *pure* app factory — no DB open, no
  timers, no port bind at construct time. A test builds the real Hono app and only
  serves it on a random port when it chooses to.
- **`setDb()`** (`backend/src/db.ts`) injects a pre-migrated in-memory SQLite handle,
  so every test runs against a real database it fully controls — no shared state, no
  fixtures file to drift.
- **`installMockExec()`** (`tests/integration/_helpers/mock-exec.ts`) stubs
  `node:child_process` so subprocess-touching code is testable without real binaries.

`tests/integration/test-app.smoke.test.ts` tests the harness itself — proof the
seams work, so the other integration tests can't pass vacuously.

## Arch tests are provably-red

Each arch test has a **sanity floor** (asserts it scanned real data) and is written
so a deliberate violation turns it red. Drop a `FIXME` into any `src` file, or an
unjustified `eslint-disable` into a non-allow-listed backend file, and
`tests/arch/forbidden-token.test.ts` / `ratchet-allowlist.test.ts` fail. The
`ratchet-allowlist` test is the one to copy when retrofitting onto an existing
codebase: point it at any debt marker and the count can only shrink.

## What NONE of these tiers cover

Be honest about the gap — it tells an agent which changes still need manual
verification:

- **Real subprocess behaviour.** Integration tests mock `child_process`; they never
  run a real external binary. A bug that only appears against the real tool slips through.
- **Real DB-file migrations.** Tests use a fresh in-memory DB. Migrating a *populated*
  on-disk database (column adds, backfills, ordering) is untested here.
- **Real external APIs.** Rate limits, auth quirks, pagination, 3xx caching — none of
  it is exercised; network calls should be mocked at the boundary and the real
  behaviour verified manually.
- **Cross-process / cross-host flows.** Anything spanning more than one process.
- **Deep production-build runtime.** The `npm run test:smoke:dist` lane now boots the
  real `tsc`-emitted `backend/dist` bundle under Node's NodeNext ESM resolver and hits
  `/api/health` + `POST /api/items`, so a broken module-resolution / ESM-emit regression
  is caught (Vitest's esbuild transpile and `tsx` would miss it). It is a *smoke*, not a
  full suite: only the health probe and one create are asserted against the built artifact.

When you touch one of these surfaces, verify it by hand and say so in the PR.
