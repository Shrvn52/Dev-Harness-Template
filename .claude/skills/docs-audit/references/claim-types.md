# Claim types and verification methods

Reference for what counts as a load-bearing claim and how to verify each
type. Used by the audit walker.

The guiding test, applied to every line: **would an agent or contributor
who trusted this claim and acted on it be misled if the claim were
wrong?** If yes, it's a claim worth auditing (T1 or T2). If no, it's
framing — skip it (T3).

## T1 — Mechanical claims (verify automatically)

Factual citations where being wrong silently misleads the reader into
broken action. All verifiable without judgment, via `grep` / `Read` /
`ls`.

### File path citations
**Examples:** `backend/src/config.ts`, `frontend/src/App.tsx`,
`shared/types.ts`, `tests/arch/`.
**Verify:** `ls` or `test -f`. PASS if the file/dir exists at the cited
path; FAIL otherwise.

### Symbol citations
**Examples:** an exported function, constant, type, or component name —
e.g. `readPort()`, `DB_PATH`, `setDb`.
**Verify:** `grep` for the exact name in the cited file (or the whole
repo if no file is named). Watch for: a symbol declared *somewhere* ≠ the
symbol exported from *the cited file*. Check the actual location, not
just existence anywhere.

### Line-number citations
**Examples:** `config.ts:29`, `App.tsx:42`.
**Verify:** `Read` the specific line and confirm the cited symbol /
behaviour is actually there. Off-by-one (and off-by-N) drift is the
dominant failure mode — code growth shifts symbols by 1–10 lines. Check
±10 lines before declaring the citation broken.

### Env-var defaults
**Examples:** *"`PORT` defaults to `8137`"*, *"`HOST` defaults to
`127.0.0.1`"*, *"`DB_PATH` defaults to `:memory:`"*.
**Verify:** Read the config module (`backend/src/config.ts` in this repo)
and confirm both the default value AND the resolution location. A doc
that says `PORT` defaults to `3000` when the code says `8137` is a silent
foot-gun — the reader binds the wrong port.

### Table counts + lists
**Examples:** *"the env-var table has 3 entries: PORT, HOST, DB_PATH"*,
*"5 npm scripts"*.
**Verify:** Enumerate the real thing (read the config module, the
`scripts` block, the migration registry, whatever the table claims to
mirror) and match both the count and the member names. Drift here is
insidious — a new env var is added to code but the doc table still says
"3 entries".

### Script / command names
**Examples:** *"`npm run dev`"*, *"`npm run build`"*, *"`npm test`"*,
*"`npm run test:integration`"*, *"`npm run test:ui`"*, *"`npm run lint`"*.
**Verify:** Cross-check against the `scripts` block of the relevant
`package.json` (root + any workspace package.json the doc references).
Failure mode: a script is renamed or removed but the doc still tells the
reader to run it.

### Version pins
**Examples:** *"pinned to `~1.2.3`"*, *"React 19"*, *"vitest v3"*.
**Verify:** Cross-check against the `dependencies` / `devDependencies` of
the relevant `package.json`. Failure mode: the pin loosens (`^` for `~`)
or the version shifts during a routine deps update, but the doc keeps the
old string.

### Config / data file inventories
**Examples:** *"config files: `app.config.json`, `settings.json`"*,
*"data lives under `backend/data/`"*.
**Verify:** `ls` the cited dir, and `grep` the codebase for readers of
any listed file. Drift happens when a feature is removed but its state
file (and the doc line naming it) is never cleaned up.

### Route / endpoint citations
**Examples:** *"routes: `/`, `/settings`, `/about`"*, *"`POST /api/x`"*.
**Verify:** `grep` the route registrations (the router setup file, e.g.
`App.tsx` / a `routes.ts`, or the backend route-mounting file). Failure
mode: a route is added/removed in code but the doc stays — silent for any
user who never types the stale URL directly.

### Assertion of file existence by name
**Examples:** *"see `CONTRIBUTING.md` for X"*, *"the `MEMORY.md` file
holds Y"*.
**Verify:** `test -f`. Most catastrophic for files referenced as
authoritative pointers — if the doc says *"see X.md for Y"* and X.md does
not exist, the reader is stranded. Watch especially for private /
generated / machine-local paths leaking into committed docs.

## T2 — Behavioural assertions (flag for code-reading review)

These describe runtime behaviour, cascade order, error semantics, or
convention enforcement. Verifiable in principle but require reading and
reasoning about the code to confirm — not safely automatable. **Mark
REVIEW and name the file the reviewer should open.** Do not guess PASS/
FAIL.

### Behavioural assertions
**Examples:** *"boot refuses to start when X is unset"*, *"an
unparseable `PORT` crashes at startup, not later"*, *"deleting a parent
row cascades to children"*.
**Action:** Mark **REVIEW**, name the implementing file (e.g. *"open
`backend/src/config.ts` and confirm `readPort()` throws on a bad
value"*).

### Convention-enforcement claims
**Examples:** *"ESLint enforces this via a `no-restricted-syntax`
selector"*, *"an arch test rejects shared/ symbols redeclared in
backend/"*.
**Action:** Mark **REVIEW**, name the lint config or arch-test file
(e.g. *"open `eslint.config.mjs` and confirm the selector exists"*).

### Specific algorithmic claims
**Examples:** *"polls every 250ms"*, *"retries 3 times with backoff"*,
*"dedupes by longest-prefix match"*.
**Action:** Mark **REVIEW**, name the implementing file. The number or
the algorithm may be exactly right — but confirming it needs a read, so
it's never an auto-PASS.

## T3 — Soft framing (skip)

Don't extract. Examples:
- Headings, section structure, table-of-contents
- General motivation / design prose (*"action-first design"*, *"keep it
  simple"*)
- Tone or style framing
- Markdown table layout itself
- Rhetorical questions in planning docs

The test for T3 is whether being "wrong" about the claim could mislead an
agent into broken action. If no, skip — extracting it just inflates the
audit with non-findings.
