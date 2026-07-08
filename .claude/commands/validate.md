---
description: Thin validation dispatcher — runs the same scripts CI runs.
allowed-tools: ['Bash']
---

# Validate

Thin dispatcher. This command does **not** re-implement any checks — it routes to the exact root npm scripts CI runs. If a lane changes, change it in `package.json` (and CI), not here.

## Run the CI lanes

Run from the repo root. Each lane mirrors a CI job:

```bash
# 1. Lint — typed-error + node:-prefix conventions (zValidator / createRouter
#    conventions are arch tests, run by lane 3)
npm run lint

# 2. Builds — frontend then backend (tsc across both tiers)
npm run build

# 3. Unit tests — backend + frontend
npm test

# 4. Integration harness — drives the real Hono app via buildApp(), in-memory SQLite
npm run test:integration

# 5. Typecheck — the tests-inclusive type gate (vitest's esbuild never type-checks);
#    covers tests/ + shared + backend/src and the frontend test surface
npm run typecheck
```

All five must exit 0.

## Built-artifact smoke (after a build)

```bash
# Boots the real backend/dist artifact under Node ESM, hits /api/health, and
# imports dist/shared as real ESM (domain-neutral — survives example deletion).
npm run test:smoke:dist
```

Needs `npm run build` to have run first (lane 2). Mirrors the smoke step CI runs in the backend job.

## UI tier (conditional)

```bash
# Playwright E2E in e2e/ui — requires a built frontend AND installed browsers.
npm run test:ui
```

Skip unless the diff touches frontend routing or end-to-end flows. Prerequisites:

- `npm run build` has produced the frontend bundle (run lane 2 first).
- Playwright browsers are installed: `npx playwright install` (one-time).

The script sets `CC_INTEGRATION=1` itself; do not export it manually.

## Summary

Report the pass/fail of each lane that ran. On failure, surface the first failing command's output **verbatim** — do not paraphrase. On full pass: **Validation PASSED**.

## Why this is short

The npm scripts in `package.json` (and the CI workflow that calls them) own the real check surface. Duplicating their logic here is drift bait — this command is a pointer, not a second source of truth.
