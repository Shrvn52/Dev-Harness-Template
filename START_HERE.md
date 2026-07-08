# START HERE

You just cloned a template whose product is its **guardrails**, not its app. The
shipped "items" app (one table, one route group, one page) exists only to prove the
wiring works — you will delete it. What you keep is the harness: lint selectors,
architecture fitness tests, CI lanes, and a committed `.claude/` setup that make
"I fixed this bug and introduced five more" mechanically hard for both you and
your AI agent.

This page is the whole onboarding. Read it once, top to bottom.

## 1 — Get green (one sitting)

```bash
nvm use     # Node 22, the tested pin (.nvmrc)
npm ci      # ONE install — npm workspaces cover backend + frontend + tooling
npm run gate
```

**`npm run gate` is the single definition of "green"** — formatting, lint,
typecheck, build, every test tier, and a boot-the-built-artifact smoke, in one
command. It runs the same scripts CI runs, so a local pass means CI-parity. You
will run it constantly; make it a reflex.

Then see the example working:

```bash
npm run dev     # backend :8137 + frontend :5173 — open http://127.0.0.1:5173
```

> Dev data is in-memory ON PURPOSE and is wiped on every file save (tsx watch
> restarts). Want it to survive? `DB_PATH=./dev.db npm run dev`.

## 2 — Hand your agent the keys

If you use Claude Code (or any agent that reads `CLAUDE.md`), the discipline is
already wired: a post-edit hook lints every file the agent touches, `CLAUDE.md`
carries the WHY/DON'T, and the arch tests fail CI on convention violations —
the agent can refactor freely because the wrong thing won't merge.

To replace the example with YOUR domain, run the guided command:

```
/start
```

Or paste this prompt into your agent:

> Read CLAUDE.md and START_HERE.md, then run `.claude/commands/start.md`'s flow:
> verify the baseline with `npm run gate`, ask me for my domain (name + fields),
> replace the items example layer by layer in the order SETUP.md lists, and
> finish by re-running `npm run gate` until green. Do not touch anything the
> docs call harness.

## 3 — What you just inherited (the 60-second tour)

| You want to…                                 | Go to                                             |
| -------------------------------------------- | ------------------------------------------------- |
| Understand the conventions + WHY each exists | [`CLAUDE.md`](CLAUDE.md) — agents read this first |
| Replace the example domain, step by step     | `/start` or [`docs/SETUP.md`](docs/SETUP.md)      |
| Understand the architecture + seams          | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)    |
| Know what each test tier does and misses     | [`docs/TESTING.md`](docs/TESTING.md)              |
| Swap a stack layer (DB / framework / UI)     | [`docs/SWAPPING.md`](docs/SWAPPING.md)            |
| Ship it                                      | `npm run build && npm start`, or the `Dockerfile` |

The guardrails worth knowing on day 1:

- **Arch tests** (`tests/arch/`) — executable conventions: every route registered,
  no duplicated shared types, no hand-parsed request bodies, lint never silenced
  off the books, env docs pinned to code. Break one and CI fails with a message
  that names the fix.
- **The post-edit hook** (`.claude/hooks/post-edit-lint.sh`) — your agent gets
  lint feedback on every edit, not after the pile-up.
- **Review invariants** (`.archon/invariants.yaml`) — the judgment-call rules no
  linter can express ("don't leak internals in error messages"), as data:
  `/review-pr` fans out a reviewer only for the rules your diff actually touches.
  Enforcing a new one is a one-line append.
- **The promotion loop** — when a review nit recurs, it becomes a lint selector or
  arch test (or, if it can never be mechanical, an invariant row) so review never
  repeats itself. This is the template's core idea; copy the pattern, not just
  the files.

## 4 — What this template will NOT do for you

Named explicitly so you plan for it instead of discovering it:

- **Auth / sessions / users** — nothing is authenticated. Add your own before
  exposing anything beyond localhost.
- **Real migrations** — `runMigrations()` is a CREATE-TABLE-IF-NOT-EXISTS seam.
  Migrating populated production data (backfills, column changes) is yours;
  `docs/ARCHITECTURE.md` → "Schema & migrations" sketches the growth path.
- **Deployment beyond one container** — the `Dockerfile` ships a single-process,
  single-writer (SQLite) app. TLS, reverse proxies, horizontal scale, managed DBs:
  day-2 decisions the template must not make for you.
- **Error reporting / observability** — `lib/logger.ts` emits structured JSON
  lines; wiring a collector (or Sentry) is yours.
- **Offline-first** — deliberately a documented seam, not a default
  (`docs/ARCHITECTURE.md` → "Offline-first extension point").

## 5 — Keeping it healthy

- Quarterly-ish (or when the scheduled `Audit` workflow goes red): the freshness
  routine in [`docs/SETUP.md`](docs/SETUP.md) → "Keeping the template fresh".
- After any big refactor: `/docs-audit` hunts prose that drifted from code — the
  mechanical mirrors are already CI-pinned, so this only has to catch prose.
- When a review comment repeats itself: promote it (see `CLAUDE.md` →
  "The promotion loop").
