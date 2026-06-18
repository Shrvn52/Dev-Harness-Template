# Harness Hardening — 12 decided improvements

**Date:** 2026-06-18
**Status:** decided, not started
**Origin:** fresh-eyes revalidation + review of the template, then a 25-agent adversarial
verification pass over this plan (see "Provenance").
**Constraint while planning:** the review was read-only; this plan is the executable record.

This plan captures 12 improvements decided one-by-one with the operator. Each item states
the **approach chosen** (alternatives considered and rejected — noted where load-bearing),
the **files to touch**, and the **validation gate** that proves it green.

> **Per-cluster gate** — after EVERY cluster the repo must be green on:
> `npm run lint && npm run typecheck && npm run build && npm test && npm run test:integration && npm run test:smoke:dist && npx playwright test && npm run test:ui`
> `typecheck` (#2) and `test:smoke:dist` (#3) are NEW scripts; until they land, omit them.
> `npm audit` is **deliberately NOT** in the per-cluster gate — per #1 it is a whole-plan
> sanity check / weekly alarm, not a merge gate; it appears only in the Final acceptance gate.

---

## Provenance — what the review + verification established (do not redo)

**Revalidation (run, not read):** everything the docs promise is true — `npm ci` ×3 = 0
vulnerabilities, no lockfile drift; lint/build/test/integration/playwright/ui all green and
fast; the built artifact boots under real Node; `.env.example` mirrors `config.ts`; the
`@shared` alias is in all three resolvers. The four `tests/arch/` checks and the two backend
lint selectors were **empirically proven non-vacuous** (injected real violations → each went
red → reverted). The items below are gaps/enrichments, not failures.

**Verification of this plan:** a 25-agent workflow re-checked every citation and stress-tested
every technical approach against code reality. Citations are accurate within ±2 lines. It
surfaced 18 confirmed corrections, all folded in below. Two corrections were **additionally
verified by hand** after the workflow: the #2 backend typecheck config compiles **EXIT 0 and is
non-vacuous** (catches an injected `TS2322` in a `tests/` file), and the registry-reverse-check
`.js`-vs-`.ts` defect is real.

---

## Execution clusters (order matters; keep green between each)

### Cluster A — Example domain (items #6, #8, #11 — they compose)

One coherent edit to the `items` example so the template *demonstrates* the patterns it
preaches (full CRUD, param validation, typed errors end-to-end).

**#11 — Add `PUT /:id` route using `updateItemSchema`** (review-finding)
- Why: `backend/src/schemas/example.ts:16` defines `updateItemSchema = createItemSchema.partial()`
  with a "can't drift" comment, but no route consumes it — the pattern is advertised, never
  demonstrated. Completing CRUD also gives #6/#8 a natural home.
- Do, in `backend/src/routes/items.ts`:
  - `import { NotFoundError, BadRequestError } from '../lib/errors.js'` (add `BadRequestError`
    alongside the existing `NotFoundError`).
  - `app.put('/:id', zValidator('param', idSchema, zodErrorHook), zValidator('json', updateItemSchema, zodErrorHook), (c) => { … })`.
  - `const { id } = c.req.valid('param')`; `const body = c.req.valid('json')`.
  - **Empty-body guard FIRST** (before any DB call): `if (body.title === undefined) throw new BadRequestError('no fields to update')`.
    **Why this is load-bearing:** `updateItemSchema` is `.partial()`, so `{}` is schema-valid
    and `body.title` is `undefined`. `items.title` is `TEXT NOT NULL` (`schema.ts:11-13`, the
    only user column). Without the guard, `UPDATE items SET title = ?` with `undefined` does
    **not** throw a bind error — better-sqlite3 (v11) coerces `undefined`→`NULL`, SQLite raises
    `SQLITE_CONSTRAINT_NOTNULL`, which is unmapped and surfaces as **HTTP 500** via
    `route-error-handler.ts:28-29`. The guard turns that into a deliberate 400 and exercises
    `BadRequestError` end-to-end (reinforces #6). (Note: the original "can't bind undefined"
    framing was wrong — it's a NOT-NULL constraint, not a bind error.)
  - `const info = getDb().prepare('UPDATE items SET title = ? WHERE id = ?').run(body.title, id)`;
    `if (info.changes === 0) throw new NotFoundError(\`item ${id} not found\`)`.
  - Re-`SELECT` the row and `return c.json(rowToItem(row))`.
  - Comment: a multi-column app replaces the single-column guard with a dynamic SET builder;
    dynamic SET is overkill for one column here.
- Rejected alt: deleting `updateItemSchema` (leaves the `.partial()` lesson undemonstrated).

**#8 — Path-param validation on `GET /:id` and `PUT /:id`** (review-finding)
- Why: `items.ts:19` hand-parses `Number(c.req.param('id'))`. CLAUDE.md preaches "validate via
  zValidator, never hand-parse" but the template never shows `zValidator('param', …)` — and
  this is the pattern people copy.
- Do: in `schemas/example.ts` add `export const idSchema = z.object({ id: z.coerce.number().int().positive() })`;
  attach `zValidator('param', idSchema, zodErrorHook)` to `GET /:id` and `PUT /:id`; read
  `const { id } = c.req.valid('param')`.
- Verified behavior: `coerce.number().int().positive()` → 400 on `abc`/`-1`/`0`/`1.5`, passes
  `999`. So `/api/items/abc` → clean 400 `{error}`; existing `/api/items/999` → 404 test stays green.

**#6 — Unit-test the typed-error mapper** (review-finding)
- Why: `lib/route-error-handler.ts` has 3 branches; only the `AppError` path is exercised
  (the 404 in `items.test.ts`). The HTTPException pass-through (`:23`) and the **unknown→500
  no-leak** fallback (`:28-29`, a security property) are untested; `ConflictError`/
  `ValidationError`/`ServiceUnavailableError` are never exercised.
- Do: new `tests/unit/route-error-handler.test.ts` calling `routeErrorHandler` directly with a
  minimal mock Hono `Context` (verified callable — a one-method `{ json: (b, s) => … }` mock suffices):
  - raw `new Error('secret /path/leak')` → status 500 AND body **exactly**
    `{ error: 'Internal server error' }` (proves no leak).
  - a duck-typed `HTTPException`-shaped object (`{ status, message, getResponse }`) → status passes through.
  - `new ConflictError('dup')` → 409 `{ error: 'dup' }`.
- Rejected alt: a contrived route to exercise 409 end-to-end (pollutes the minimal example).
  The `PUT` from #11 already adds a real `NotFoundError` + `BadRequestError` end-to-end path.

**Cluster A tests:** `tests/integration/items.test.ts` — PUT happy path (200 + updated title),
**PUT empty body `{}` → 400 `{error}`**, PUT missing id (404), `GET /api/items/abc` (400). Plus
the new unit test above.
**Gate:** lint + build + test + integration green.

---

### Cluster B — Built-artifact correctness (item #3)

**#3 — `nodenext` + built-artifact smoke** (review-finding/enrichment)
- Why: `tsconfig.base.json` sets `moduleResolution: "bundler"`, inherited by the backend, which
  actually RUNS under Node's NodeNext ESM resolver (`npm start` = `node dist/...`). Works today
  only because every relative import hand-carries `.js`; `bundler` doesn't enforce that. An
  extensionless import would pass tsc+vitest+CI and crash `npm start`. `docs/TESTING.md:53-54`
  admits the built bundle "is built in CI but not exercised end-to-end."
- Do (two parts, both):
  1. `backend/tsconfig.json`: set `"module": "nodenext"` and `"moduleResolution": "nodenext"`
     (overrides base). **Verified clean:** backend src+shared compile EXIT 0 under nodenext —
     no `better-sqlite3` / `../../../shared/*.js` / hono interop nits (every relative import
     already carries `.js`). Frontend keeps `bundler` (Vite honors it). Resolution-mode note:
     the #2 typecheck config may use `bundler` for backend files — that's fine; extension
     **enforcement** is the build's job (nodenext), and backend src checks clean under both modes.
  2. Add a **zero-dep `tools/smoke.mjs`** (mirroring `tools/dev.mjs`'s `node:child_process`
     pattern — the repo's documented ethos: dev.mjs replaced `concurrently` to keep root
     audit-clean; no shell/curl in npm scripts):
     - `spawn` `node dist/backend/src/index.js` with `cwd: 'backend'` (the artifact is at
       `backend/dist/backend/src/index.js`; there is **no top-level `dist/`** — `node dist/...`
       from repo root is ENOENT, which is why every backend-touching root script does `cd backend`),
       `env: { ...process.env, PORT: '8138', DB_PATH: ':memory:' }` (8138 avoids the 8137 default;
       `:memory:` makes the smoke self-contained, auto-migrates, leaves no file artifact).
     - Poll `http://127.0.0.1:8138/api/health` via node global `fetch` in a retry/backoff loop
       until 200 or ~5s timeout (boot is async — poll, don't `sleep`); assert body
       `{ ok: true, status: 'healthy' }`.
     - POST `http://127.0.0.1:8138/api/items` `{ title: 'smoke' }` → expect 201.
     - `child.kill('SIGTERM')` in a `finally`; `process.exit(1)` on any failure, `exit(0)` on success.
     - NOTE the `/api/` prefix: endpoints are `/api/health` and `/api/items`, not bare paths.
     - Add `"test:smoke:dist": "node tools/smoke.mjs"` to **root** `package.json`. **Name it
       `test:smoke:dist`** (not `test:smoke`) to avoid conflation with the existing in-process
       `tests/integration/test-app.smoke.test.ts` ("the harness tests itself" — a Vitest test on
       an injected in-memory DB that already runs under `npm test`). The new lane boots the real
       built artifact. Wire as a CI step in the `backend` job **after build** (NOT inside
       `npm test` — needs the built `dist`).
- Gate: build (nodenext) + `npm run test:smoke:dist` green.

---

### Cluster C — Arch test (item #7)

**#7 — Registry reverse-coverage** (review-finding)
- Why: `tests/arch/registry-coverage.test.ts` enforces registry→backing but not
  backing→registry. A new `routes/foo.ts` not added to `ROUTES` stays green + silently
  unmounted. `docs/ARCHITECTURE.md:324-332` recommends copying this test for a migration
  registry, where silent-skip is dangerous — so fixing the archetype matters most.
- Do: add to `registry-coverage.test.ts` a check that reads `backend/src/routes/`, filters
  `*.ts` except `registry.ts`, asserts the set is non-empty (sanity floor — already exists at
  `:15-17`), then for each file asserts the registry **source** contains the exact
  `'./<base>.js'` **import specifier**. **Critical:** match the `.js` import form, NOT the
  on-disk `.ts` filename — `registry.ts:2-3` uses NodeNext ESM imports (`import health from
  './health.js'`), so `src.includes('health.ts')` finds ZERO matches for a correctly-registered
  route (verified). Use a quote-anchored regex to avoid prefix false-positives (a base that is a
  substring of another registered import). The `.js` extension is reliable because #3 (nodenext)
  enforces it. Concrete heuristic to embed:
  ```ts
  const src = readFileSync(registryPath, 'utf8');
  const files = readdirSync(routesDir).filter(f => f.endsWith('.ts') && f !== 'registry.ts');
  expect(files.length).toBeGreaterThan(0); // sanity floor
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const f of files) {
    const base = f.replace(/\.ts$/, '');
    const re = new RegExp(`['"]\\./${esc(base)}\\.js['"]`);
    expect(re.test(src), `routes/${f} is not registered in ROUTES`).toBe(true);
  }
  ```
  Read `registry.ts` **source via fs** — do NOT inspect the imported `ROUTES` array (its path
  strings are `/api/*` URLs, not filenames). Document the implied convention: **no non-router
  helper files in `routes/`** (one-liner in ARCHITECTURE.md and/or a test comment). Currently
  satisfied — only `health.ts`/`items.ts`/`registry.ts` exist.
- Gate: arch tier green; manually verify red on an unregistered `routes/__probe.ts`, then revert.

---

### Cluster D — CI / workflows (items #1, #10, #13)

**#1 — Scheduled audit lane** (enrichment)
- Why: README/CLAUDE.md headline "0 vulnerabilities" but nothing runs `npm audit`; it rots silently.
- Do: new `.github/workflows/audit.yml` — `on: { schedule: [{cron: '0 6 * * 1'}], workflow_dispatch: {} }`.
  `actions/checkout@v4` + `actions/setup-node` (`node-version-file: .nvmrc`), then **NO `npm ci`** —
  `npm audit` resolves from the lockfile alone (verified: audit against a dir with only
  package.json + lockfile returns "0 vulnerabilities", exit 0). Three steps: `npm audit
  --audit-level=high` at root, `--prefix backend`, `--prefix frontend` (verified: `--prefix`
  audits each subproject's own tree — they are three separate npm projects, no workspaces). Put
  `if: always()` on the 2nd and 3rd steps so a root vuln doesn't hide a backend/frontend one.
  **Non-blocking** for PRs (the schedule lane never runs on PRs). Optional: open/update an issue on failure.
  (Unrelated to the `lockfile-drift` job in `pr.yml:136` — that uses `npm install --package-lock-only`
  to assert no drift; do not conflate.)
- Rejected alt: hard per-PR gate (can red-block unrelated PRs on an unfixable transitive).

**#10 — e2e paths-filter includes package files** (review-finding)
- Why: `pr.yml:55-60` e2e filter omits package files, so a dep-only bump (the case most likely
  to break E2E) skips the only lane that'd catch it. (lint/backend lanes already watch package files.)
- Do: add `package*.json`, `backend/package*.json`, `frontend/package*.json` to the `e2e` filter
  block. (Verified: dorny/paths-filter@v3 uses picomatch; these globs are valid — the config
  already uses brace expansion.)

**#13 — Gitleaks secret-scan lane** (enrichment)
- Why: widely-cloned template; cheap leak insurance; reinforces the "don't leak" ethos.
- Do: add a `secret-scan` job to `pr.yml` using `gitleaks/gitleaks-action@v2` with
  `actions/checkout@v4` `fetch-depth: 0`. Only the auto-provided `GITHUB_TOKEN` is needed —
  **no `GITLEAKS_LICENSE`** (verified: repo is personal-account-owned; gitleaks-action@v2 needs a
  license only for org-owned repos). **Org-transfer trap:** if the repo ever moves to an org, the
  license becomes mandatory — note this in a workflow comment. No secret-shaped fixtures exist
  that would false-positive; add a `.gitleaks.toml` allowlist only if one appears.
- NOTE: Dependabot was **explicitly rejected** — unmerged-PR noise on a non-actively-maintained
  reference repo. Gitleaks kept; Dependabot dropped.
- Gate: `pr.yml` + `audit.yml` valid YAML; push a branch and confirm Actions parse.

---

### Cluster E — Typecheck tooling (item #2) — the trickiest item

**#2 — Tests-inclusive typecheck gate** (review-finding)
- Why: no tsconfig includes `tests/`; `frontend/tsconfig.json` excludes `*.test.tsx`; Vitest
  (esbuild) strips types without checking. A type error in any test/arch file passes all gates —
  the guardrail code is itself unguarded.
- **Root cause that breaks the naive fix:** a repo-root `tsconfig.typecheck.json` that includes
  `tests/` fails with **14 TS2307 errors on a clean clone** — `tests/` files import bare
  specifiers (`vitest`, `hono`, `@hono/node-server`, `better-sqlite3`) that live ONLY in
  `backend/node_modules`, and TS resolves bare imports from each file's own directory walking up,
  so `tests/` walks to the (test-dep-less) repo root. Confirmed location-independent. Two
  guardrail surfaces also have different dep roots: `frontend/src/App.test.tsx` +
  `frontend/src/test-setup.ts` need `frontend/node_modules` (`@testing-library/*`) plus JSX/DOM
  libs. → **Two configs, rooted where the deps live.**

- **Do — #2a backend/tests lane (VERIFIED green + non-vacuous):** new
  `backend/tsconfig.typecheck.json` with explicit `paths` remapping the test-only bare specifiers
  to `backend/node_modules` (this is the load-bearing detail; `better-sqlite3` is **@types-only**
  so it maps to its types package, not the JS package):
  ```jsonc
  {
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
      "noEmit": true, "rootDir": "..", "baseUrl": ".",
      "paths": {
        "@shared/*": ["../shared/*"],
        "vitest": ["./node_modules/vitest"],
        "hono": ["./node_modules/hono"], "hono/*": ["./node_modules/hono/*"],
        "@hono/node-server": ["./node_modules/@hono/node-server"],
        "@hono/zod-validator": ["./node_modules/@hono/zod-validator"],
        "zod": ["./node_modules/zod"],
        "better-sqlite3": ["./node_modules/@types/better-sqlite3"]
      }
    },
    "include": ["src", "../shared", "../tests"]
  }
  ```
  Script (root): `"typecheck:backend": "cd backend && tsc -p tsconfig.typecheck.json"`.
  **Verified:** EXIT 0 on a clean `npm ci`, and red (`TS2322`) on an injected type error in a
  `tests/` file. backend/src + shared are already build-checked; the new surface this adds is `tests/`.
  - Rejected alt — **root devDependencies** (add vitest/hono/better-sqlite3/etc. to root so
    `tests/` resolves from root): simpler and more robust, but it **falsifies ARCHITECTURE.md:56-62's
    "the root dep tree stays tiny (only Playwright + ESLint live there)" claim** and would force a
    doc edit + grow root's audit surface. The `paths`-remap keeps root thin; the specifier list is
    bounded (tests import only the 4 top-level packages above). Use root-devDeps only if the
    `paths` list proves too churny — and update ARCHITECTURE.md if so.
  - Rejected alt — `vitest --typecheck`: only checks `*.test-d.ts` type-assertion files, reports
    "No test files found" against this suite.

- **Do — #2b frontend test lane (closes the OPEN ITEM; VERIFIED non-vacuous):** new
  `frontend/tsconfig.typecheck.json` = `frontend/tsconfig.json` with `"noEmit": true` and the
  three test excludes **removed** (`src/**/*.test.ts`, `src/**/*.test.tsx`, `src/test-setup.ts`;
  keep `node_modules`, `dist`). They can't fold into the root config — they need `jsx: react-jsx`,
  DOM lib, and the `@testing-library/jest-dom` augmentation. Script:
  `"typecheck:frontend": "cd frontend && tsc -p tsconfig.typecheck.json"`. (Verified: EXIT 0;
  injecting `const x: number = '…'` → TS2322; bogus matcher → TS2551, so jest-dom matcher types
  resolve and the lane is non-vacuous.)

- **Do — aggregate:** root `"typecheck": "npm run typecheck:backend && npm run typecheck:frontend"`
  (mirrors how `test` aggregates). Add a CI lane mirroring the lint lane that runs `npm run
  typecheck`; add it to `.claude/commands/validate.md` as lane 5.
- **Gate:** `npm run typecheck` EXIT 0 on a fresh `npm ci` (confirm BEFORE marking #2 done — the
  naive root config is RED on a clean clone); then verify it goes red on a deliberate type error
  in **both** a `tests/` file AND `frontend/src/App.test.tsx`, and revert. Until green, keep
  `typecheck` omitted from the per-cluster gate per the existing carve-out.

---

### Cluster F — Hook visibility (item #9)

**#9 — Surface the silently-disabled lint hook** (review-finding)
- Why: `.claude/hooks/post-edit-lint.sh` no-ops (exit 0) when `jq` is missing (`:15`) — fail-safe
  but fail-silent; the user believes lint is active when it isn't. On-thesis: a mechanical
  guardrail that disables itself invisibly.
- Do: in the `command -v jq … || exit 0` branch (`:15`), print ONE stderr notice via a
  per-session sentinel (`/tmp/cc-lint-hook-warned.$PPID`) then `exit 0`. **`$PPID` IS stable**
  here — CC spawns each PostToolUse hook as a child of the one long-lived `claude` process per
  session (verified), so the sentinel is genuinely once-per-session, not per-edit. Add a one-line
  code comment saying so, so a future reader doesn't "fix" a non-bug. **Do NOT switch the key to
  `session_id`** — this branch is reached precisely because `jq` is unavailable, so a JSON parse
  can't run; a sed-based parse is off-thesis complexity for a courtesy notice. Keep the
  eslint-not-installed case (`:27`, expected on fresh clone) **quiet**. Never block.
- Gate: shellcheck-clean; manual — jq present (silent), jq simulated-absent (one notice, exit 0,
  second run silent).

---

### Cluster G — Docs (items #4, #12)

**#4 — `npm ci` in setup docs** (revalidation-fix)
- Why: `README.md:48-50` and `docs/SETUP.md:35-37` tell new users `npm install` ×3, but CI
  installs exclusively via `npm ci` (`pr.yml:74,90,107,123-125`) and ships a `lockfile-drift`
  guard (`pr.yml:136-148`) *because* `npm install` rewrites lockfiles (commit `0a8f295`). The
  first command a user runs contradicts the enforced reproducible-install posture.
- Do (switch to `npm ci`):
  - `README.md:48-50` (the 3 install commands in the Quickstart ```bash fence at :46).
  - `docs/SETUP.md:35-37` (the 3 install commands in the fence at :34). **(There is no root
    `SETUP.md` — it is `docs/SETUP.md`.)**
  - Add near each block: "use `npm install <pkg>` only when intentionally adding/bumping a
    dependency." Draw the `npm ci` (reproducible) vs `npm install` (changing deps) line.
- Do (descriptive mentions — reword for consistency):
  - `docs/SETUP.md:16` "`npm install` will compile the binding" → "`npm ci` will compile the binding".
  - `docs/ARCHITECTURE.md:59` "**`npm install` runs three times**" → "**`npm ci` runs three
    times**" (or make it a generic statement — decide, do not leave un-triaged; the original plan
    omitted ARCHITECTURE.md). NOTE: if the #2 root-devDeps alternative is ever chosen, this same
    line's "tiny root tree" framing at `:56-62` also needs revisiting.
  - `plans/2026-06-17-harness-blueprint.md:228` — a **tracked, active** plan whose green-on-clone
    block still uses `npm install` ×3; an agent copying it reintroduces the drift. Update it to
    `npm ci` ×3 or add a footnote pointing at this item.
- DROP the "keep CLAUDE.md consistent" clause: `git grep` finds zero `npm install`/`npm ci` in
  CLAUDE.md — nothing to fix there.
- Gate: `git grep -n 'npm install' -- README.md docs/SETUP.md docs/ARCHITECTURE.md` returns only
  the intentional `npm install <pkg>` guidance sentence(s).

**#12 — "Use this template" on-ramp** (enrichment)
- Why: no GitHub-template designation, no one-line on-ramp; first-clone UX is the
  `docs/SETUP.md` hand-edit table only.
- Do: add a short README "Use this template" section (Use-template button → `nvm use` → `npm ci`
  ×3 → follow the `docs/SETUP.md` swap table → tests catch misses). Mark the repo as a GitHub
  template (`gh repo edit --template` — confirmed real — or repo Settings; **outward-facing,
  confirm with operator**).
- Rejected alt: a `tools/rename-example.mjs` codegen script — self-rotting drift surface, off-thesis.
- Gate: docs-only; run `docs-audit` or eyeball that no claim drifted.

---

## OUT — explicitly rejected (record so they aren't re-proposed)

- **#5 committed git hook** — CI + the CC PostToolUse hook already gate the real workflow; a
  non-auto, opt-in hook is redundancy, not new coverage. (Husky also rejected: violates the
  zero-root-deps ethos.)
- **#13 Dependabot** — unmerged-PR noise on a reference/template repo not actively dependency-
  maintained. Gitleaks kept; Dependabot dropped.

---

## Final acceptance gate (whole plan done)

Pre-execution tree hygiene: run `git status --porcelain` first. This plan file
(`plans/2026-06-18-harness-hardening.md`) is the only expected untracked file at start; commit
it with the harness work. Delete any leftover review scratch (`tsconfig.typecheck*.tmp.json`,
`*.mytmp.json`) before starting; do NOT delete `tsconfig.typecheck.json`/`backend/tsconfig.typecheck.json`
once #2 creates them.

From repo root, all green:
```
npm run lint
npm run typecheck                                # new (#2) — contingent on the #2a/#2b configs; green verified on clean npm ci
npm run build                                    # backend now nodenext (#3)
npm test                                         # unit + integration + arch (incl. new tests #6/#7/#8/#11)
npm run test:integration
npm run test:smoke:dist                          # new (#3) — boots the real built artifact
npx playwright test
npm run test:ui
npm audit --audit-level=high                     # root tree — still 0 (#1 sanity)
npm audit --audit-level=high --prefix backend    # backend tree — still 0
npm audit --audit-level=high --prefix frontend   # frontend tree — still 0
```
Plus: `git status` clean of stray artifacts; CI workflows (`pr.yml`, `audit.yml`) parse; the new
arch reverse-check and the typecheck gate each verified red-on-violation then reverted.

## Suggested PR slicing

Production code needs PRs (per repo policy); `.claude/`, `.github/`, docs, and this plan are
lighter. Reasonable grouping: (1) Cluster A example-domain PR, (2) Cluster B nodenext+smoke PR,
(3) Cluster C arch + Cluster E typecheck PR, (4) Cluster D CI workflows PR, (5) Cluster F+G
hook+docs PR. Or one "harness hardening" PR for a single review.

## Correction log (this plan was adversarially verified — 18 confirmed fixes folded in)

1. Count 11→12 IN items. 2. `docs/SETUP.md` (no root SETUP.md); install lines are README:48-50 /
docs/SETUP.md:35-37. 3. Smoke artifact path is `backend/dist/backend/src/index.js` (no top-level
`dist/`). 4. Smoke renamed `test:smoke:dist` (avoid clash with existing in-process
`*.smoke.test.ts`). 5. `#2` naive root config is RED on clean clone (14 TS2307) → two-config
design with `paths`-remap; **verified green + non-vacuous**. 6. `better-sqlite3` maps to
`@types/better-sqlite3`. 7. `#2b` frontend typecheck closes the open item (verified). 8. Registry
reverse-check matches `'./<base>.js'` (anchored regex), NOT `.ts`. 9. PUT empty-body guard
(`BadRequestError`); mechanism is NOT-NULL→500, not a bind error. 10. Smoke = zero-dep
`tools/smoke.mjs` (node `fetch` poll, port 8138, `:memory:`, SIGTERM), not inline bash/curl.
11. `audit.yml` skips `npm ci`; `if: always()` on 2nd/3rd steps. 12. Final gate audits ×3
(root + `--prefix backend` + `--prefix frontend`). 13. `$PPID` sentinel is stable (don't "fix"
to `session_id`). 14. `#4` also fixes docs/SETUP.md:16, docs/ARCHITECTURE.md:59,
plans/2026-06-17-harness-blueprint.md:228; drop the CLAUDE.md clause (no matches). 15. Per-cluster
gate vs final gate: `npm audit` deliberately final-only. 16. nodenext build verified clean (no
interop nits). 17. param-validation reject/pass cases verified. 18. route-error-handler unit test
verified callable with a mock Context.
