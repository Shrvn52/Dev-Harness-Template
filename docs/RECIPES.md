# Recipes — patterns the template teaches but no longer ships

The v3 prune removed code that demonstrated a pattern but had no consumer — dead
demonstration code drifts and mis-teaches (the pruned subprocess mock had a
fidelity bug for exactly that reason). The PATTERNS are still endorsed; this file
is their home. Copy a recipe in when your domain actually needs it. The original
full implementations live in git history (`git log --diff-filter=D --summary`).

---

## Const-array-derived unions — one source for value list + type

When a value list crosses the shared boundary (sort fields, statuses, roles),
the array is the SSOT and the union type is DERIVED — never a second,
hand-maintained `type X = 'a' | 'b'` that can drift from the runtime list:

```ts
// shared/<your-domain>.ts
export const SORT_FIELDS = ['created_at', 'title'] as const;
export type SortField = (typeof SORT_FIELDS)[number]; // 'created_at' | 'title'
```

Adding a value is a one-line edit the type system picks up everywhere, and the
runtime array is right there for zod (`z.enum(SORT_FIELDS)`) and UI dropdowns.
Corollary (CLAUDE.md → Conventions): a magic number used across the boundary
(page sizes, limits) belongs in `shared/` as a named constant, declared once —
not inlined at call sites.

---

## The subprocess seam — shell out through one stubbable wrapper

Nothing in the template shells out, so it ships no exec code. When your domain
does, keep it testable: route EVERY subprocess call through one promisified
wrapper, and stub the module underneath it in integration tests.

```ts
// backend/src/lib/exec.ts — the seam. Callers never import child_process.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** Resolves { stdout, stderr }; rejects on non-zero exit. */
export const execFileAsync = promisify(execFile);
```

Test it by mocking `node:child_process` itself (`vi.doMock`) so the wrapper
inherits the stub transparently — record calls for assertion, replay canned
responses per command. Two hard-won details the pruned implementation learned:

- **Mock the `util.promisify.custom` symbol** on your `execFile` stub, or the
  promisified form won't resolve `{ stdout, stderr }` the way the real one does.
- **Failure fidelity:** real `execFile` rejects with `err.code` as a **number**
  (the exit code) and a message like `Command failed: …`. A mock that sets
  `code: 'ENOENT'`-style strings for exit failures teaches your code to branch
  on the wrong shape — it'll pass tests and misbehave in production. Assert
  against the real error shape once (a tiny test that runs `false` or
  `node -e 'process.exit(3)'`) before trusting the mock.

And keep the honesty rule from `TESTING.md`: mocked-subprocess tests never prove
the real binary behaves — say so in the PR when you touch that surface.
