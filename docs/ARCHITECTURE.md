# Architecture

The deeper reference that `README.md` and `CLAUDE.md` defer to. It explains the
non-obvious structural decisions — the ones you'd otherwise have to reverse-engineer
from the build output or trip over while wiring up a new module.

---

## Monorepo layout

```
dev-harness-template/
├── package.json            # workspace root (backend, frontend) + the one lockfile
├── tsconfig.base.json      # the one compiler baseline both packages extend
├── tools/                  # zero-dep launchers: dev.mjs (dual dev servers), smoke.mjs
├── Dockerfile              # the minimal ship path (build + prod-deps runtime stages)
├── backend/                # Hono + better-sqlite3 + Zod  (own package.json)
│   ├── src/
│   │   ├── index.ts        # buildApp() + startServer() (+ static serving of frontend/dist)
│   │   ├── config.ts       # env resolution (PORT/HOST/DB_PATH/LOG_LEVEL)
│   │   ├── db.ts           # getDb/setDb/closeDb
│   │   ├── schema.ts       # runMigrations()
│   │   ├── lib/            # errors, route-error-handler, hono-app, zod-hook, logger
│   │   ├── routes/         # health.ts, items.ts, registry.ts (SSOT)
│   │   └── schemas/        # zod input schemas
│   └── tsconfig.json
├── frontend/               # React 19 + Vite 6 + Tailwind v4 + TanStack Query
│   ├── src/
│   │   ├── main.tsx        # QueryClientProvider root
│   │   ├── App.tsx         # the example surface — delete it
│   │   └── api.ts          # data layer (the offline seam — see below)
│   ├── vite.config.ts      # dev/preview servers + the PORT-aware /api proxy
│   ├── vitest.config.ts    # the jsdom test tier
│   └── tsconfig.json
├── shared/                 # cross-boundary types (NO build step, imported relatively)
├── tests/                  # unit/ · integration/ · arch/
└── e2e/                    # Playwright — example-api.spec.ts + ui/example.spec.ts
```

### Why npm workspaces (and what the previous cd-delegation cost)

The root `package.json` declares `"workspaces": ["backend", "frontend"]`. One
`npm ci` at the root installs every tier into one hoisted tree, under one lockfile.
Root scripts delegate with `-w`:

```json
"build": "npm run build -w frontend && npm run build -w backend",
"test":  "npm test -w backend && npm test -w frontend"
```

The template originally used cd-delegation (three independent npm projects) to keep
each package's toolchain isolated. That design had a structural flaw the isolation
never paid for: the cross-cutting `tests/` tier needed `hono`/`zod`/`vitest` types,
so the root `package.json` **mirrored** the backend's runtime deps — and the two
declarations drifted (root pinned `hono@4.12.25` while backend declared `^4.12.14`).
Tests were type-checked against one resolution and _run_ against another, with
nothing to detect the skew. Workspaces dissolve the whole failure class:

- **One resolution per dep.** `tests/` and `backend/src` resolve `hono` from the
  same hoisted install — the typecheck gate and the runtime can no longer disagree.
  The root `package.json` now declares only genuinely-root tooling (ESLint,
  Playwright, prettier, typescript).
- **One lockfile.** `lockfile-drift` and `npm audit` each check a single file that
  carries every tier's resolutions; `npm ci` runs once in every CI lane.
- **`shared/` is deliberately NOT a workspace.** It has no dependencies and no build
  step; it needs only its `{"type":"module"}` marker for NodeNext emit (see the
  shared-boundary section). Making it a workspace would add symlink indirection for
  zero benefit.
- **Lifting a package out** now means running `npm install` in its new home to give
  it its own lockfile — a one-command cost, paid only on the rare extraction, instead
  of a mirrored-dep drift risk paid continuously.

`tools/dev.mjs` remains a zero-dependency `spawn` wrapper (no `concurrently`) so the
dep tree stays `npm audit`-clean on a fresh clone.

---

## The shared boundary

`shared/` holds the only types that cross the front/back wire. It has
**no build step** — both packages compile it from source as part of their own `tsc`
pass (the backend `include`s `../shared/**/*`; the frontend `include`s `../shared`).

Two enforced rules make the boundary load-bearing rather than aspirational:

1. **One source per name.** `tests/arch/no-duplicate-shared-exports.test.ts` fails
   if any name exported from `shared/` is _re-declared_ in `backend/src/` or
   `frontend/src/`. Re-exports (`export { X } from '../../shared/...'`) are fine — only
   a second fresh declaration of the same identifier is a violation. This is the
   tripwire that stops a `STATUS_COLORS` in `shared/` and a second one in
   `frontend/` from drifting silently.

2. **Casing convention encodes the layer.** SQL-row types mirror column names and
   are `snake_case` (`ItemRow.created_at`); DTOs assembled in TypeScript are
   `camelCase` (`Item.createdAt`). `rowToItem()` is the mapping seam between them.
   The split is intentional — do not "fix" the snake_case rows.

### Relative imports on BOTH sides (and _why_ there is no alias)

The same `shared/` file is imported relatively from both packages — only the
extension differs:

```ts
// frontend/src/api.ts        — bundler resolution, extensionless
import type { Item } from '../../shared/types';

// backend/src/routes/items.ts — NodeNext ESM, needs the emitted .js name
import { rowToItem, type ItemRow } from '../../../shared/types.js';
```

Why the backend can't use an alias at all: **`tsc` does not rewrite path aliases
in emitted JS.** If backend code imported `@shared/types`, the emitted
`dist/.../items.js` would still say `@shared/types`, and Node at runtime has no
idea what that means (no bundler, no path-mapping loader). Relative paths with the
`.js` extension survive emit verbatim and resolve under Node's ESM resolver — the
`.js` (not `.ts`) on a TypeScript import is the _output_ filename.

Why the frontend doesn't use one either, even though Vite could: an alias must be
declared in **every resolver that ever touches the import** — Vite, Vitest, and
the type-checker each resolve modules independently, and each declaration is a
place to drift (miss one and imports work in some contexts while silently breaking
in others). A previous iteration of this template carried exactly that lockstep
burden across multiple config files. Relative paths resolve identically in every
tool for free, so the template's rule is simply: **`shared/` is imported
relatively, everywhere.** If you later adopt an alias anyway (deep frontend trees
make `../../..` chains ugly), know what you're buying: declare it in every
resolver and treat a missing declaration as the first suspect when an import
breaks in only one context.

### Where the backend build lands — `dist/backend/src` + `dist/shared`

`backend/tsconfig.json` sets `rootDir: ".."` and `include: ["src/**/*", "../shared/**/*"]`.
Because `rootDir` is the repo root, `tsc` preserves the relative directory structure
under `outDir`, producing:

```
backend/dist/
├── backend/src/index.js   ← start script points here: node dist/backend/src/index.js
└── shared/types.js        ← the relative ../../../shared/types.js import resolves here
```

Emitting under `backend/dist/` (rather than a repo-root `dist/`) is what lets
`backend/package.json`'s `"type": "module"` apply to the output — the nearest
`package.json` walking up from `dist/backend/src/index.js` is the backend's, so Node
treats the emitted `.js` as ESM. The `../../../shared/types.js` relative import
that the source uses lands exactly on `dist/shared/types.js` after emit, so the same
import string is correct in both source and build. This is the mechanical reason the
backend can't use the alias: the relative path is the only form that is simultaneously
valid pre-build (source tree) and post-build (`dist/` tree).

---

## The `buildApp` / `setDb` seams

Two seams make the backend testable without standing up a real process or a real DB
file. They are the reason the integration tier can drive the _real_ app at HTTP
speed against an in-memory database.

### `buildApp()` — the pure app factory

`backend/src/index.ts` separates app _construction_ from process _boot_:

```ts
export function buildApp(): Hono {            // pure — NO side effects
  const app = new Hono();
  app.onError(routeErrorHandler);
  for (const { path, app: routeApp } of ROUTES) app.route(path, routeApp);
  return app;
}

export function startServer(): void {          // binds the port — boot only
  serve({ fetch: buildApp().fetch, port: PORT, hostname: HOST }, ...);
}

if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) startServer();
```

`buildApp()` opens no DB, starts no timer, spawns no subprocess, and binds no port.
A test can call it, inject a DB, and `serve()` on a random port only when _it_
chooses. The `if (argv[1] && …)` guard means importing `index.ts` from a test never
boots a server — `startServer()` runs only when the file is the process entrypoint
(`tsx src/index.ts` / `node dist/.../index.js`). **Keep `buildApp()` side-effect-free;
the entire integration harness hangs on it.**

### `setDb()` — in-memory DB injection

`backend/src/db.ts` owns a single module-level handle:

```ts
export function getDb(): Database.Database {
  /* lazy-open file DB, run migrations */
}
export function closeDb(): void {
  /* close + clear */
}
export function setDb(d: Database.Database): void {
  db = d;
} // @internal test seam
```

Route handlers call `getDb()` and never touch a connection directly. A test opens its
own `new Database(':memory:')`, runs `runMigrations()` on it, and calls `setDb()` to
swap it into the singleton **before** `buildApp()`. Production never calls `setDb()` —
there's no runtime guard; the discipline is the contract.

### How the two compose — the integration harness

`tests/integration/_helpers/test-app.ts` is the only place these seams meet:

```ts
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
runMigrations(db);
setDb(db); // inject
const app = buildApp(); // real app, real routes
const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
// → tests hit `http://127.0.0.1:<port>` with real fetch()
```

This drives the real Hono app, the real router registry, the real zod validators,
and the real error handler — over real HTTP — against a throwaway in-memory DB. It
catches route/schema/wiring bugs the unit tier can't. (What it _misses_ — real
DB-file migrations, real external APIs, real subprocesses — is documented in
`TESTING.md`; that honesty is the asset.)

---

## The request pipeline — typed errors + zValidator

Every route is built the same way, and two libraries do the heavy lifting so handlers
stay thin.

### Typed errors → uniform wire shape

Service and route code **throws** typed errors from `lib/errors.ts` instead of
hand-assembling responses:

```ts
if (!row) throw new NotFoundError(`item ${id} not found`); // → 404 { error: "..." }
```

| Class                     | Status |
| ------------------------- | ------ |
| `BadRequestError`         | 400    |
| `NotFoundError`           | 404    |
| `ConflictError`           | 409    |
| `ValidationError`         | 422    |
| `ServiceUnavailableError` | 503    |
| `AppError` (base)         | 500    |

`lib/route-error-handler.ts` is the Hono `onError` that converges _everything_ to one
shape — `{ error: string }` at the right status. `AppError` subclasses carry their
own status; a Hono `HTTPException` (duck-typed to dodge the CJS/ESM `instanceof`
mismatch) passes its status through; anything else logs its stack and returns a
generic 500 (never leaking internals). This is what lets handlers drop per-route
`try/catch → c.json(...)` boilerplate.

`routeErrorHandler` is attached in two places that must stay consistent:

- `buildApp()` attaches it to the top-level app.
- `lib/hono-app.ts`'s `createRouter()` attaches it to **each sub-router**, because
  Hono's `onError` is per-app and not inherited. A test that calls
  `itemsRouter.request(...)` directly bypasses the parent app — without `createRouter()`
  the sub-router would have no handler and the typed-error mapping would differ
  between the mounted path and the direct-request path. **Every `routes/*.ts` does
  `const app = createRouter()`.**

### zValidator → validated input, same error shape

Mutation routes validate JSON bodies with `@hono/zod-validator`, never a hand-rolled
`await c.req.json()`:

```ts
app.post('/', zValidator('json', createItemSchema, zodErrorHook), (c) => {
  const { title } = c.req.valid('json');   // typed + validated
  ...
});
```

- Schemas live in `backend/src/schemas/` (e.g. `createItemSchema`). The update schema
  is derived (`createItemSchema.partial()`) so create and update can't drift.
- `lib/zod-hook.ts`'s `zodErrorHook` rewrites a validation failure into the same
  `{ error: string }` / 400 shape the rest of the API uses, instead of zod's default
  body — so a malformed request and a thrown `BadRequestError` look identical on the
  wire.

### Route registry — the SSOT

`backend/src/routes/registry.ts` exports `ROUTES: RouteEntry[]`, the single source of
truth for mounted routes. `buildApp()` iterates it; `tests/arch/registry-coverage.test.ts`
asserts every entry exposes a real Hono router and a unique, `/api/`-prefixed path.
Adding a route is: write `routes/foo.ts` (using `createRouter()`), then append one
line to `ROUTES`. Importing the registry in the arch test already proves the backing
file exists — a bad import throws there.

---

## Schema & migrations

The template ships the **smallest thing the seams attach to**: `backend/src/schema.ts`
exports one idempotent `runMigrations(db)` that `CREATE TABLE IF NOT EXISTS items`.
`db.ts` calls it on first `getDb()`; the integration harness calls it directly on its
in-memory handle. That's the whole migration story today, on purpose — a template
shouldn't pre-build a migration framework you might not want.

### Growing into a registry-driven migration system

When one-shot `CREATE IF NOT EXISTS` stops being enough (you need ordered,
write-once, idempotent schema changes), grow `schema.ts` into a registry the same
shape as the route registry:

1. **One file per migration** — `backend/src/migrations/<NNN>-<slug>.ts`, each
   exporting a `Migration` const: `{ id: string; up(db): void }`.
2. **A `MIGRATIONS: Migration[]` array** is the boot-order SSOT (mirror
   `routes/registry.ts`).
3. **A `schema_meta` table** records applied migration IDs. `runMigrations(db)`
   reads the applied set and runs only the pending entries, in array order, each in
   a transaction.
4. **An arch test** asserts every migration file appears in the array (copy
   `registry-coverage.test.ts` and re-point it) — so a dropped-in file that nobody
   registered fails CI. The test now checks **both directions**: registry→backing
   (a registered entry must have a file) AND backing→registry (every `routes/*.ts`
   router file must be imported by the registry). The reverse check matches the
   `'./<base>.js'` import specifier in `registry.ts` source, not the on-disk `.ts`
   name — NodeNext ESM imports carry `.js`. Implied convention it enforces: **`routes/`
   holds only router files**; non-router helpers belong in `lib/`.

The seam is already in the right place: `runMigrations` is the single entry both `db.ts`
and the test harness call, so swapping its body for a registry walk requires no caller
changes.

---

## The ship path — deliberately minimal

`npm run build && npm start` produces a real deployable: `startServer()` mounts
`frontend/dist` behind the API routes when a build exists (`findFrontendDist()`
walks up from the module, so it works from both the source tree and the emitted
`dist/` tree). The SPA fallback serves `index.html` for unknown non-`/api` GETs;
`/api/*` keeps the JSON `{ error }` 404 contract. No build present → API-only mode,
announced at boot.

The `Dockerfile` is the whole deploy story: a build stage (full workspace install +
`npm run build`) and a runtime stage (prod deps + the two `dist/` trees,
`HOST=0.0.0.0`, `DB_PATH=/data/app.db` behind a volume). Static serving lives in
`startServer()`, NOT `buildApp()` — the factory stays pure for the integration tier.

**What is intentionally absent** (day-2 decisions the template must not make for
you): TLS/reverse proxy, auth, CORS (same-origin by construction — one port),
horizontal scaling (SQLite is single-writer), error reporting, and DB migrations
beyond `runMigrations()`. See `START_HERE.md` → "What this template will NOT do".

---

## Offline-first extension point

**Offline-save is intentionally NOT built into this template.** Offline-first —
a service worker, a local write store, and sync-on-reconnect with conflict
resolution — is a _substantial application architecture_, not a harness discipline.
Baking it in would force a local-first data model onto every project spun from the
template, most of which won't want it, and it carries real, app-specific complexity
(merge semantics, conflict UX, cache invalidation). So the template keeps it a
**documented seam**, not a default.

### Where it plugs in

The entire seam is the frontend **data layer** — `frontend/src/api.ts` plus the
TanStack Query usage in components. Today that layer is a thin pair of `fetch`
wrappers:

```ts
// frontend/src/api.ts
export async function fetchItems(): Promise<Item[]> {
  /* fetch('/api/items') */
}
export async function createItem(title: string): Promise<Item> {
  /* POST /api/items */
}
```

…consumed by TanStack Query:

```ts
// frontend/src/App.tsx
const { data: items } = useQuery({ queryKey: ['items'], queryFn: fetchItems });
const add = useMutation({ mutationFn: createItem, onSuccess: () => qc.invalidateQueries(...) });
```

Because every read and write already funnels through `api.ts` and through Query's
cache, an offline layer slots in **behind that interface** without touching components:

1. **Local cache (reads).** Back `fetchItems` with IndexedDB: read from the local
   store first, return it immediately, and revalidate from the network in the
   background (a service worker can also serve the app shell + a `/api` cache for a
   true offline boot). TanStack Query's cache + `staleTime` is the in-memory half of
   this; IndexedDB is the durable half.

2. **Sync-on-reconnect queue (writes).** Wrap `createItem` (and friends) so a mutation
   while offline writes to the local store, enqueues the intent in an IndexedDB
   outbox, and optimistically updates the Query cache. A `navigator.onLine` /
   `online` event (or a service-worker Background Sync registration) drains the
   outbox to the real endpoints on reconnect, then reconciles — last-write-wins, or a
   real merge if the domain needs it.

3. **Where the code lives.** A `frontend/src/offline/` module (the IndexedDB schema,
   the outbox, the sync driver) plus a service worker registered from `main.tsx`.
   `api.ts` becomes the switch between the network path and the offline-aware path.
   Components and the query keys are untouched — that's the point of keeping the seam
   at the data layer.

Keep it a seam: if a project needs offline, it builds the `offline/` module against
this interface; if it doesn't, it pays nothing. The harness's job is to make sure the
seam is in the obvious place — it is `api.ts`.
