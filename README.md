# Dev-Harness-Template

A starter repo that bakes in the **agentic-development discipline** — the harness
layer that lets an AI agent refactor freely without silently breaking things. It is
opinionated about _structure and discipline_, neutral about _what you build_. You
pour your own product into a skeleton whose guardrails are already wired and green.

> One idea: **make the right thing mechanical and the wrong thing impossible to merge.**
> Every convention an agent could violate is either a hard CI failure (a lint
> selector, an arch test, a typed-error mapper) or documented in exactly one place
> with its failure mode and a "do not" tag.

## What's in the box

- **`CLAUDE.md`** — the engineering single-source-of-truth: WHY + DON'T, with WHAT +
  WHERE offloaded. The first thing an agent reads.
- **Mechanical enforcement** — a flat ESLint config (incl. one worked custom selector)
  - a `tests/arch/` fitness-test tier that turns conventions into CI-blocking checks.
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

TypeScript monorepo (npm workspaces, one lockfile): **Hono** backend +
**React 19 / Vite 6 / Tailwind v4 / TanStack Query** frontend + **better-sqlite3** +
**Zod**, tested with **Vitest** + **Playwright**. ~70% of the value (the CLAUDE.md
discipline, the arch-test concept, the CI routing, the test-taxonomy shape, the
committed `.claude/` harness) is stack-agnostic; the rest is TypeScript worked
examples to adapt — [`docs/SWAPPING.md`](docs/SWAPPING.md) maps exactly which is which
and how to swap a layer out.

## Requirements

- Node **22** (pinned in `.nvmrc`) · npm 10+
- For the UI E2E tier: `npx playwright install chromium`

## Use this template

1. Click **Use this template → Create a new repository** (top of the GitHub page), or
   `gh repo create <you>/<name> --template Shrvn52/Dev-Harness-Template`.
2. Clone your new repo, then: `nvm use` → `npm ci` (one install covers every
   workspace).
3. Confirm green: `npm run lint && npm run typecheck && npm test`.
4. Replace the `items` example with your own domain following the swap table in
   [`docs/SETUP.md`](docs/SETUP.md) — the arch tests and typecheck catch anything you miss.

## Quickstart

```bash
nvm use                      # Node 22 (the tested pin; engines floor is >=20)
npm ci                       # ONE install — workspaces cover backend + frontend

npm run dev                  # backend :8137 + frontend :5173

npm run lint                 # mechanical conventions
npm test                     # unit + integration + arch (+ frontend jsdom)
npm run test:integration     # API integration tier only
npm run build                # frontend then backend
npx playwright install chromium && npm run build && npm run test:ui   # UI E2E
```

Everything above is green on a fresh clone — the wiring **is** the documentation.

> Use `npm ci` for a **reproducible** install from the committed lockfile (what CI
> runs, and what the `lockfile-drift` guard protects). Reach for `npm install <pkg>`
> only when you are **intentionally adding or bumping a dependency**.

## Where to go next

| You want to…                                            | Read                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| Understand the conventions + why each exists            | [`CLAUDE.md`](CLAUDE.md)                       |
| Understand the architecture + the import/seam decisions | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Set up and start replacing the example domain           | [`docs/SETUP.md`](docs/SETUP.md)               |
| Understand the test tiers + what they don't cover       | [`docs/TESTING.md`](docs/TESTING.md)           |
| Swap a whole stack layer (DB / framework / frontend)    | [`docs/SWAPPING.md`](docs/SWAPPING.md)         |

## License

MIT — see [`LICENSE`](LICENSE).
