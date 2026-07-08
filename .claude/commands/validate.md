---
description: Thin validation dispatcher — runs the same scripts CI runs.
allowed-tools: ['Bash(npm run gate)', 'Bash(npm run test:ui)', 'Bash(npx playwright:*)']
---

# Validate

Thin dispatcher. This command does **not** re-implement any checks — it routes to the exact root npm scripts CI runs. If a lane changes, change it in `package.json` (and CI), not here.

## The gate

```bash
npm run gate
```

`gate` is the single definition of "green" — format:check → lint → typecheck → build → test (unit + integration + arch + frontend jsdom) → built-artifact smoke. It is the same script chain CI's lanes run, so a local pass here means CI-parity: there is no weaker local gate to be fooled by.

## UI tier (conditional)

```bash
npm run test:ui
```

Skip unless the diff touches frontend routing or end-to-end flows. Prerequisites:

- `npm run gate` has already run (it builds the frontend bundle `vite preview` serves).
- Playwright browsers are installed: `npx playwright install chromium` (one-time).

The script sets `CC_INTEGRATION=1` itself; do not export it manually.

## Summary

Report pass/fail. On failure, surface the first failing command's output **verbatim** — do not paraphrase. On full pass: **Validation PASSED**.

## Why this is short

The `gate` script in `package.json` (and the CI workflow that runs the same scripts) owns the real check surface. Duplicating its logic here is drift bait — this command is a pointer, not a second source of truth.
