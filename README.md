# Dev-Harness-Template

A starter repo that bakes in the **agentic-development discipline** — the harness
layer that lets an AI agent refactor freely without silently breaking things. It is
opinionated about *structure and discipline*, neutral about *what you build*. You
pour your own product into a skeleton whose guardrails are already wired and green.

> One idea: **make the right thing mechanical and the wrong thing impossible to merge.**
> Every convention an agent could violate is either a hard CI failure (a lint
> selector, an arch test, a typed-error mapper) or documented in exactly one place
> with its failure mode and a "do not" tag.

## What's in the box

- **`CLAUDE.md`** — the engineering single-source-of-truth: WHY + DON'T, with WHAT +
  WHERE offloaded. The first thing an agent reads.
- **Mechanical enforcement** — a flat ESLint config (incl. one worked custom selector)
  + a `tests/arch/` fitness-test tier that turns conventions into CI-blocking checks.
- **Four green test tiers** — unit / integration (via the `buildApp()`+`setDb()` seams)
  / arch / Playwright E2E. See [`docs/TESTING.md`](docs/TESTING.md).
- **A committed `.claude/` harness** — a post-edit lint hook, review subagents, and
  thin `/validate` + `/review-pr` commands, so the discipline travels with every clone.
- **CI + GitHub conventions** — a paths-filtered PR workflow, lockfile-drift guard,
  issue/PR templates, a label taxonomy.
- **A docs-audit skill** + an **optional, fenced `.archon/`** invariants module.

The shipped backend/frontend/`items` domain is an **example** — delete it and pour
your own in (start with [`docs/SETUP.md`](docs/SETUP.md)).

## Stack

TypeScript monorepo (cd-delegation, not workspaces): **Hono** backend +
**React 19 / Vite 6 / Tailwind v4 / TanStack Query** frontend + **better-sqlite3** +
**Zod**, tested with **Vitest** + **Playwright**. ~70% of the value (the CLAUDE.md
discipline, the arch-test concept, the CI routing, the test-taxonomy shape, the
committed `.claude/` harness) is stack-agnostic; the rest is TypeScript worked
examples to adapt.

## Requirements

- Node **22** (pinned in `.nvmrc`) · npm 10+
- For the UI E2E tier: `npx playwright install chromium`

## Quickstart

```bash
nvm use                      # Node 22
npm install                  # root tooling (eslint, playwright)
npm install --prefix backend
npm install --prefix frontend

npm run dev                  # backend :8137 + frontend :5173

npm run lint                 # mechanical conventions
npm test                     # unit + integration + arch (+ frontend jsdom)
npm run test:integration     # API integration tier only
npm run build                # frontend then backend
npx playwright install chromium && npm run build && npm run test:ui   # UI E2E
```

Everything above is green on a fresh clone — the wiring **is** the documentation.

## Where to go next

| You want to… | Read |
|---|---|
| Understand the conventions + why each exists | [`CLAUDE.md`](CLAUDE.md) |
| Understand the architecture + the import/seam decisions | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Set up and start replacing the example domain | [`docs/SETUP.md`](docs/SETUP.md) |
| Understand the test tiers + what they don't cover | [`docs/TESTING.md`](docs/TESTING.md) |

## License

MIT — see [`LICENSE`](LICENSE).
