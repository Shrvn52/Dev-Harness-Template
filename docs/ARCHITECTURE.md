# Architecture

The deeper reference that `README.md` and `CLAUDE.md` defer to. It explains the
non-obvious structural decisions — the ones you'd otherwise have to reverse-engineer
from the build output or trip over while wiring up a new module.

---

## Monorepo layout

```
dev-harness-template/
├── package.json            # root scripts — cd-delegation, NOT npm workspaces
├── tsconfig.base.json      # the one compiler baseline both packages extend
├── tsconfig.json           # root type-check (resolves @shared/* against ./shared)
├── tools/dev.mjs           # zero-dep dual dev-server launcher
├── backend/                # Hono + better-sqlite3 + Zod  (own package.json)
│   ├── src/
│   │   ├── index.ts        # buildApp() + startServer()
│   │   ├── config.ts       # env resolution (PORT/HOST/DB_PATH)
│   │   ├── db.ts           # getDb/setDb/closeDb
│   │   ├── schema.ts       # runMigrations()
│   │   ├── lib/            # errors, route-error-handler, hono-app, zod-hook, exec
│   │   ├── routes/         # health.ts, items.ts, registry.ts (SSOT)
│   │   └── schemas/        # zod input schemas
│   └── tsconfig.json
├── frontend/               # React 19 + Vite 6 + Tailwind v4 + TanStack Query
│   ├── src/
│   │   ├── main.tsx        # QueryClientProvider root
│   │   ├── App.tsx         # the example surface — delete it
│   │   └── api.ts          # data layer (the offline seam — see below)
│   ├── vite.config.ts      # @shared + @ aliases (place 1 of 3)
│   ├── vitest.config.ts    # @shared + @ aliases (place 2 of 3)
│   └── tsconfig.json       # @shared + @ paths (place 3 of 3)
├── shared/                 # cross-boundary types + constants (NO build step)
├── tests/                  # unit/ · integration/ · arch/
└── e2e/                    # Playwright — example-api.spec.ts + ui/example.spec.ts
```

### Why cd-delegation, not npm workspaces

The root `package.json` is **not** a workspace root. Its scripts shell into each
package:

```json
"build": "cd frontend && npm run build && cd ../backend && npm run build",
"test":  "cd backend && npm test && cd ../frontend && npm test"
```

`backend/` and `frontend/` each carry their own `package.json`, `node_modules`,
and lockfile. The trade is deliberate:

- **Each package owns its toolchain.** The backend pins `tsx`/`vitest`/`better-sqlite3`;
  the frontend pins `vite`/`@vitejs/plugin-react`/`jsdom`. Neither hoists into a
  shared root tree, so a frontend dep bump can't silently shift a backend
  transitive, and the root dep tree stays tiny (only Playwright + ESLint live there).
- **A package is liftable.** Because nothing depends on workspace hoisting, you can
  copy `backend/` out to its own repo without untangling a hoisted graph.
- **`npm install` runs three times** (root, backend, frontend) — the one cost. The
  `tools/dev.mjs` launcher exists for the same "no shared root deps" reason: it
  replaces `concurrently` with a zero-dependency `spawn` so the root tree stays
  `npm audit`-clean on a fresh clone.

---

## The shared boundary

`shared/` holds the only types and constants that cross the front/back wire. It has
**no build step** — both packages compile it from source as part of their own `tsc`
pass (the backend `include`s `../shared/**/*`; the frontend `include`s `../shared`).

Two enforced rules make the boundary load-bearing rather than aspirational:

1. **One source per name.** `tests/arch/no-duplicate-shared-exports.test.ts` fails
   if any name exported from `shared/` is *re-declared* in `backend/src/` or
   `frontend/src/`. Re-exports (`export { X } from '@shared/...'`) are fine — only
   a second fresh declaration of the same identifier is a violation. This is the
   tripwire that stops a `STATUS_COLORS` in `shared/` and a second one in
   `frontend/` from drifting silently.

2. **Casing convention encodes the layer.** SQL-row types mirror column names and
   are `snake_case` (`ItemRow.created_at`); DTOs assembled in TypeScript are
   `camelCase` (`Item.createdAt`). `rowToItem()` is the mapping seam between them.
   The split is intentional — do not "fix" the snake_case rows.

### The relative-vs-`@shared` import split (and *why*)

The same `shared/` file is imported two different ways depending on which side
imports it:

```ts
// frontend/src/api.ts        — alias form
import type { Item } from '@shared/types';

// backend/src/routes/items.ts — relative form
import { rowToItem, type ItemRow } from '../../../shared/types.js';
```

This asymmetry is not an oversight. It falls out of how each package emits:

- **The backend compiles to JavaScript** (`tsc` → `backend/dist/`). TypeScript's
  path aliases are a *type-checking* convenience — **`tsc` does not rewrite them in
  the emitted JS.** If backend code imported `@shared/types`, the emitted
  `dist/.../items.js` would still say `@shared/types`, and Node at runtime has no
  idea what that means (no bundler, no path-mapping loader). So the backend uses
  **real relative paths with the `.js` extension** that survive emit verbatim and
  resolve at runtime under Node's ESM resolver. That `.js` (not `.ts`) on a
  TypeScript import is required by `moduleResolution: "bundler"`/NodeNext-style
  ESM — it's the *output* filename.

- **The frontend never emits the shared file to disk.** Vite bundles everything,
  and its bundler *does* honor the `@shared` alias (declared in `vite.config.ts`).
  Its `tsc` pass is `noEmit: true` — purely a type-check — so there's no runtime
  artifact for an unrewritten alias to break. The alias form is cleaner and works
  in every frontend context **as long as it's declared in all three resolvers**
  (below).

So: **backend = relative `.js` imports** (must survive `tsc` emit and run under raw
Node), **frontend = `@shared` alias** (Vite rewrites it; `tsc` only checks it).

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

### The "declare the alias in three places" gotcha

`@shared/*` (and `@/*`) must be declared in **three** resolvers on the frontend, or
imports work in some contexts and silently break in others:

| Resolver | File | Resolves modules for… |
|---|---|---|
| Vite | `frontend/vite.config.ts` (`resolve.alias`) | dev server + production bundle |
| Vitest | `frontend/vitest.config.ts` (`resolve.alias`) | the jsdom test runner |
| TypeScript | `frontend/tsconfig.json` (`compilerOptions.paths`) | the type-checker (editor + `tsc`) |

Miss the Vite entry → runtime/bundle breaks but types pass. Miss the Vitest entry →
tests fail to resolve while dev works. Miss the tsconfig entry → editor red squiggles
and `tsc` errors while everything *runs* fine. The three are kept in lockstep on
purpose; both config files carry a comment to that effect. (The backend's Vitest
config declares only `@shared` for its own test imports — it has no `@` because the
backend doesn't use one.)

---

## The `buildApp` / `setDb` seams

Two seams make the backend testable without standing up a real process or a real DB
file. They are the reason the integration tier can drive the *real* app at HTTP
speed against an in-memory database.

### `buildApp()` — the pure app factory

`backend/src/index.ts` separates app *construction* from process *boot*:

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
A test can call it, inject a DB, and `serve()` on a random port only when *it*
chooses. The `if (argv[1] && …)` guard means importing `index.ts` from a test never
boots a server — `startServer()` runs only when the file is the process entrypoint
(`tsx src/index.ts` / `node dist/.../index.js`). **Keep `buildApp()` side-effect-free;
the entire integration harness hangs on it.**

### `setDb()` — in-memory DB injection

`backend/src/db.ts` owns a single module-level handle:

```ts
export function getDb(): Database.Database { /* lazy-open file DB, run migrations */ }
export function closeDb(): void { /* close + clear */ }
export function setDb(d: Database.Database): void { db = d; }   // @internal test seam
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
setDb(db);                                       // inject
const app = buildApp();                          // real app, real routes
const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
// → tests hit `http://127.0.0.1:<port>` with real fetch()
```

This drives the real Hono app, the real router registry, the real zod validators,
and the real error handler — over real HTTP — against a throwaway in-memory DB. It
catches route/schema/wiring bugs the unit tier can't. (What it *misses* — real
subprocess, real DB-file migrations, real external APIs — is documented in
`TESTING.md`; that honesty is the asset.)

### The subprocess seam

`backend/src/lib/exec.ts` exports a single `execFileAsync = promisify(execFile)`.
Everything that shells out goes through it. `tests/integration/_helpers/mock-exec.ts`
stubs `node:child_process` (re-declaring the `util.promisify.custom` symbol so the
promisified form still resolves `{ stdout, stderr }`), and the wrapper inherits the
stub transparently — subprocess-touching code becomes testable without real binaries,
and every call is recorded for assertion.

---

## The request pipeline — typed errors + zValidator

Every route is built the same way, and two libraries do the heavy lifting so handlers
stay thin.

### Typed errors → uniform wire shape

Service and route code **throws** typed errors from `lib/errors.ts` instead of
hand-assembling responses:

```ts
if (!row) throw new NotFoundError(`item ${id} not found`);   // → 404 { error: "..." }
```

| Class | Status |
|---|---|
| `BadRequestError` | 400 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `ValidationError` | 422 |
| `ServiceUnavailableError` | 503 |
| `AppError` (base) | 500 |

`lib/route-error-handler.ts` is the Hono `onError` that converges *everything* to one
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

## Offline-first extension point

**Offline-save is intentionally NOT built into this template.** Offline-first —
a service worker, a local write store, and sync-on-reconnect with conflict
resolution — is a *substantial application architecture*, not a harness discipline.
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
export async function fetchItems(): Promise<Item[]> { /* fetch('/api/items') */ }
export async function createItem(title: string): Promise<Item> { /* POST /api/items */ }
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
