# Dev-Harness-Template

A starter repo that bakes in the **agentic-development discipline** — the harness
layer that lets an AI agent (or you) refactor freely without silently breaking
things. Opinionated about _structure and discipline_, neutral about _what you build_:
you delete the example app and pour your own in; the guardrails are already wired
and green.

## Start here

**→ [`START_HERE.md`](START_HERE.md)** — the whole onboarding on one page, for you
AND your agent.

```bash
nvm use && npm ci    # Node 22 pin; ONE workspaces install
npm run gate         # THE definition of green — same scripts CI runs
npm run dev          # backend :8137 + frontend :5173
```

Replacing the example with your domain is a guided step: run **`/start`** in
Claude Code, or follow [`docs/SETUP.md`](docs/SETUP.md).

> One idea: **make the right thing mechanical and the wrong thing impossible to merge.**
> Every convention an agent could violate is either a hard CI failure (a lint
> selector, an arch test, a typed-error mapper) or documented in exactly one place
> with its failure mode and a "do not" tag.

## What's in the box

- **`CLAUDE.md`** — the engineering single-source-of-truth: WHY + DON'T, with WHAT +
  WHERE offloaded to code. The first thing an agent reads.
- **Mechanical enforcement** — a flat ESLint config (incl. worked custom selectors)
  plus a `tests/arch/` fitness-test tier that turns conventions into CI-blocking
  checks: route-registry coverage, no duplicated shared types, no hand-parsed
  bodies, a shrink-only lint-debt ratchet, env docs pinned to code, and more (the
  directory is the inventory).
- **Green test tiers** — unit / integration (via the `buildApp()`+`setDb()` seams) /
  arch / frontend jsdom / Playwright E2E, plus a domain-neutral built-artifact
  smoke. One command — **`npm run gate`** — runs the lot at CI-parity.
- **A committed `.claude/` harness** — a post-edit lint hook, advisory review
  subagents, `/start` (guided adoption), `/validate`, `/review-pr`, and a
  docs-audit skill, so the discipline travels with every clone.
- **CI + GitHub conventions** — paths-filtered PR lanes with an always-on format
  gate and a single fan-in required check, lockfile-drift guard, sha-pinned
  supply chain (gitleaks binary, paths-filter action), issue/PR templates, a
  label taxonomy.
- **A minimal ship path** — `npm run build && npm start` serves API + frontend on
  one port; one `Dockerfile`. Nothing more, on purpose.

The shipped backend/frontend/`items` domain is an **example to delete** —
[`START_HERE.md`](START_HERE.md) §4 also lists what the template deliberately does
NOT do (auth, real migrations, orchestration), so you can plan day 2 instead of
discovering it.

## Stack

TypeScript monorepo (npm workspaces, one lockfile): **Hono** backend +
**React 19 / Vite 6 / Tailwind v4 / TanStack Query** frontend + **better-sqlite3** +
**Zod**, tested with **Vitest** + **Playwright**. Most of the value (the CLAUDE.md
discipline, the arch-test concept, the CI routing, the test taxonomy, the committed
`.claude/` harness) is stack-agnostic; the rest is worked examples to adapt —
[`docs/SWAPPING.md`](docs/SWAPPING.md) maps which is which and how to swap a layer.

## Requirements

- Node **22** (pinned in `.nvmrc`) · npm 10+
- For the UI E2E tier: `npx playwright install chromium`

## Where to go next

| You want to…                                            | Read                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| Onboard yourself + your agent                           | [`START_HERE.md`](START_HERE.md)               |
| Understand the conventions + why each exists            | [`CLAUDE.md`](CLAUDE.md)                       |
| Set up and start replacing the example domain           | [`docs/SETUP.md`](docs/SETUP.md)               |
| Understand the architecture + the import/seam decisions | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Understand the test tiers + what they don't cover       | [`docs/TESTING.md`](docs/TESTING.md)           |
| Swap a whole stack layer (DB / framework / frontend)    | [`docs/SWAPPING.md`](docs/SWAPPING.md)         |

## License

MIT — see [`LICENSE`](LICENSE).
