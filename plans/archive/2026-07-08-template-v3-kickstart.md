# Template v3 — prune to purpose, drift-proof the docs, a true start-here

**Date:** 2026-07-08
**Status:** decided with the operator, ready to execute
**Origin:** 53-finding multi-agent audit (48 confirmed, 5 partial, 0 refuted — every
finding reproduced against live code) + four operator decisions. The audit's meta-lesson:
the template proved its own thesis — even a repo built around "docs must not drift"
shipped a dozen drifted claims, because the drift channels were structural, not sloppy.

## Root causes (fix these, not the symptoms)

1. **Docs that MIRROR code.** Command tables mirroring `package.json`, env tables
   mirroring `config.ts`, counts ("three resolvers", "four arch tests"), a delete
   checklist mirroring the dependency graph. Mirrors drift; pointers don't.
2. **Enforcement narrower than the claims.** Frontend-only PRs skip every arch test;
   inline `/* eslint rule: "off" */` comments silence tier-1 rules with zero ratchet
   debt; `throw Error()` without `new` passes the flagship selector; `format:check`
   never runs on the file class (docs) people edit most; the review commands tell
   reviewers conventions are "covered by lint" that no rule covers.
3. **Demonstration code with no consumer.** The exec seam, `shared/constants.ts`, the
   logger — patterns shipped but never demonstrated, so they rot and mislead.
4. **Fail-loud doctrine with silent-failure holes.** Symlinked entry → exits 0, no
   server; broken `DB_PATH` → healthy `/api/health` + 500ing data routes; `dev.mjs`
   orphans tsx/vite on non-Ctrl-C shutdown; tests red under ambient `LOG_LEVEL`.

## Operator decisions (do not relitigate)

- **Scope → prune hard.** Anything without a runtime consumer goes: exec seam,
  `shared/constants.ts`, `.archon/`. (Supersedes v2's "keep `.archon/`" — the operator
  was its sole user; template consumers inherit only noise.) The logger is the one
  survivor: `no-console` needs a sanctioned target, so it gets a real consumer instead.
- **Docs → hybrid.** Delete every mirror that can be a pointer; the few load-bearing
  mirrors that remain (env vars, `.env.example`) get a mechanical arch test. New prose
  rule: docs never state counts of code artifacts ("five arch tests") — counts are
  greppable, prose isn't.
- **Start-here → both.** A root `START_HERE.md` for the human AND a `/start` command
  the adopter's agent runs — the delete-the-example checklist becomes executable steps
  that end with the same gate CI runs, so it cannot drift green-locally/red-in-CI.
- **Production → minimal ship path.** Backend serves `frontend/dist` + one small
  Dockerfile. `npm run build && npm start` becomes a real deployable artifact. No
  compose, no deploy workflows, no auth — documented as out of scope.

---

## Cluster 0 — housekeeping (trivial)

- `git mv plans/2026-07-08-template-v2.md plans/archive/` — v2 is fully executed
  (verified cluster-by-cluster against git history).

## Cluster 1 — prune (small)

- Delete `backend/src/lib/exec.ts`, `tests/integration/_helpers/mock-exec.ts`,
  `tests/integration/exec.test.ts` (zero production callers; the mock also had a
  fidelity bug — string `err.code` vs execFile's number — which is what un-demonstrated
  patterns do: teach wrong). Scrub references from TESTING.md / SETUP.md / ARCHITECTURE.md.
- Delete `shared/constants.ts` (zero importers) + its SETUP.md swap-table row.
- Delete `.archon/` + references (README, CLAUDE.md, eslint/prettier ignores).
- Delete the unused `@/*` alias from all three frontend configs (zero uses).

## Cluster 2 — close the enforcement holes (small, highest urgency)

1. Typed-error selector also matches no-`new` calls:
   `ThrowStatement > :matches(NewExpression, CallExpression)[callee.name=/^(Error|…)$/]`.
2. `linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' }` in
   `eslint.config.mjs` — kills the uncounted `/* eslint rule: "off" */` silencing channel
   the ratchet cannot see.
3. `pr.yml` backend-lane filter gains `frontend/**` — four arch tests scan
   `frontend/src` but the only lane that runs them currently skips frontend-only PRs.
4. `format:check` moves to its own **always-run** job (it takes seconds; path-filtering
   it let docs-only PRs land unformatted and break main for the next TS PR).
5. `.nvmrc` joins every path filter — a Node bump currently merges with zero lanes run.
6. `e2e/**`, `tools/**`, `playwright.config.ts` enter the lint + typecheck perimeter
   (new eslint block; add to `tsconfig.typecheck.json`); `e2e` joins the ratchet +
   forbidden-token scan roots.
7. Registry reverse-coverage walks `routes/` recursively (a router in a subdirectory is
   currently silently unmounted and undetected).
8. **Make the review commands' claims true instead of deleting them** (the promotion
   loop, applied): two new arch checks — no `c.req.json(` under `backend/src/routes/`
   (zValidator is the way in) and no `new Hono(` outside `lib/hono-app.ts` +
   `index.ts` (createRouter is the way). Then `/review-pr`'s "DO NOT FLAG — covered"
   list and `/validate`'s lane description become accurate; sync both texts.
9. Pin `dorny/paths-filter` to a commit SHA (it decides which gates run at all; it was
   the one third-party action left on a mutable tag while gitleaks got a sha256).
10. Fix `pr.yml`'s stale `permissions` comment (still justifies `pull-requests: read`
    via gitleaks-action, which the workflow no longer uses).

## Cluster 3 — structural + runtime fixes (medium)

1. **Kill the alias, not the count.** Drop `@shared` everywhere; the frontend imports
   `shared/` relatively, exactly like the backend already does. Six lockstep resolver
   declarations → zero. (Rejected: making `shared/` a workspace package — it would need
   its own build step, trading a documented hazard for permanent machinery.) The one
   remaining hazard (`shared/package.json` `type:module`) keeps its smoke-tier canary.
2. `index.ts` direct-run guard compares **realpaths** — today a symlinked entry (deploy
   `current/`, npm link) exits 0 with no server and no output.
3. `startServer()` calls `getDb()` eagerly — a broken `DB_PATH` must crash at boot
   (the documented fail-loud contract), not 500 per-request behind a lying healthcheck.
4. `tools/dev.mjs` spawns detached process groups and kills `-pid` — teardown currently
   orphans tsx/vite on every non-Ctrl-C exit, leaving 8137/5173 bound (EADDRINUSE +
   silent vite port-hop next run). Add a spawn `error` handler.
5. `vite.config.ts` proxies read `process.env.PORT ?? 8137` (both server and preview) —
   makes SETUP.md's already-published claim true; code moves to the doc here because
   the doc describes the behavior adopters want.
6. `backend/vitest.config.ts` pins `test.env` (`LOG_LEVEL`, `PORT`, `DB_PATH`) — the
   suite must be green regardless of the adopter's shell exports.
7. `route-error-handler.ts` unknown-error fallback uses `lib/logger.ts` — the logger
   gains its real consumer, the repo's only `eslint-disable` disappears, the ratchet
   allowlist reaches its goal state (empty; drop the non-empty sanity floor with a
   rationale comment), and the scary `[unhandled] … secret /path/leak` stack trace in
   green test output goes away (the test spies the logger instead).
8. `buildApp()` gains an `app.notFound` returning `{ error: 'not found' }` 404 — the
   documented uniform wire shape currently breaks on unknown paths (text/plain).
9. **`tools/smoke.mjs` goes domain-neutral:** boot the dist, `GET /api/health`, and
   dynamically import `dist/shared/*.js` (the actual CJS-emit canary). The hardcoded
   `POST /api/items` goes — deleting the example must not break a harness-owned lane.

## Cluster 4 — one gate command (trivial, load-bearing)

- New root script **`npm run gate`**: format:check → lint → typecheck → build → test →
  test:smoke:dist. It is the single definition of "green": `/validate` dispatches to it,
  START_HERE and `/start` end with it, CI lanes run the same scripts. This kills the
  green-locally/red-in-CI class at the root — there is no second, weaker local gate for
  docs to cite.

## Cluster 5 — minimal ship path (small)

- Backend serves `frontend/dist` (static middleware + SPA index fallback for non-`/api`
  GETs) when the build exists. `npm run build && npm start` = the whole app on one port.
- One multi-stage `Dockerfile` (`node:22-slim` — glibc keeps better-sqlite3 prebuilds
  working) + `.dockerignore`: build stage, prod-deps runtime stage, `HOST=0.0.0.0`,
  `DB_PATH=/data/app.db`, `VOLUME /data`, `EXPOSE 8137`.
- Smoke test asserts `/` serves the built index when dist is present.

## Cluster 6 — docs, hybrid drift-proofing (medium)

- **CLAUDE.md:** command table → pointer ("`package.json` scripts are the SSOT; the one
  command is `npm run gate`"). Env table stays (load-bearing) but gains a mechanical
  guard: a new arch test diffs the table's var names + `.env.example` against
  `process.env.*` reads in `config.ts`. Fix the tier-3 mutation convention to match the
  shipped code it contradicts (mutations return the resource DTO; failures are
  `{ error: string }` + status). Remove all artifact counts from prose.
- **SETUP.md:** the delete-the-example section becomes a short overview pointing at
  `/start`; every "confirm green" instruction becomes `npm run gate`. Fix the PORT
  claim (true after Cluster 3.5).
- **TESTING.md / ARCHITECTURE.md / SWAPPING.md:** correct the audited drift (missing
  frontend-tier row, arch-test inventory wording, DB-swap checklist errors, layout map
  missing `logger.ts`/`LOG_LEVEL`, alias prose rewritten for relative imports).
- **`.claude/` truthfulness:** reviewer agents get explicit `tools:` frontmatter
  matching their claimed powers; `settings.json` allowlist drops `npm run dev` (the one
  pre-approved command that hangs and leaks processes) and gains the gate scripts;
  docs-audit's `audits/` output dir joins `.gitignore` + `.prettierignore` (its first
  report currently fails the CI format gate).

## Cluster 7 — START_HERE.md + /start (medium)

- **`START_HERE.md`** at the repo root, linked first in README, written for the human
  AND their agent: what this template is / is NOT (auth, migrations, deploys beyond the
  Dockerfile — named explicitly, in TESTING.md's honest "what's not covered" style);
  verify green (`npm ci && npm run gate`); a copy-paste prompt block that hands the
  adopter's agent the repo conventions and points it at `/start`; day-2 pointers.
- **`.claude/commands/start.md`** — guided adoption the agent executes: run the gate to
  prove the baseline, collect the adopter's domain (name, fields), walk the replacement
  in dependency order (shared types → schema → zod schemas → routes → registry →
  frontend api/App → tests/e2e), finish with `npm run gate` — the same gate CI runs, so
  by-the-book adoption cannot land green-locally/red-in-CI.
- README's first screen: one paragraph + the START_HERE link; pitch and philosophy move
  below the fold.

## Explicitly rejected

- Full deploy example (compose, cloud workflows) — where "years coding on a template"
  starts; every artifact ages.
- Auth / migration framework / error reporting — named in START_HERE as out of scope
  instead of shipped.
- `shared/` as a workspace package — trades a documented hazard for a build step.
- Doc-generation tooling — the hybrid (pointers + two arch tests) covers it without a
  generator to maintain.
- Renovate/Dependabot — v2's decision stands; the freshness routine is the caretaker.

## Acceptance gate

`npm ci && npm run gate && npx playwright test` all green; `docker build` + `docker run`
serves `/` and `/api/health`; a scratch clone driven only by START_HERE + `/start`
(delete example → new domain) reaches green with **no step outside the documented path**;
re-run the docs-audit skill — zero T1 findings.
