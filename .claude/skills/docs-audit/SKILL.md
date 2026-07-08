---
name: docs-audit
description: Audit every Markdown doc in this repo for load-bearing factual claims that have drifted from code reality. Walks file paths, symbol names, line-number citations, env-var defaults, table lists/counts, version pins, and script names; verifies T1 (mechanical) claims via grep/Read/ls, flags T2 (behavioural) claims for code-reading review, skips T3 (framing prose). Produces a date-stamped report so drift-accumulation rate stays visible. The audit agent is deliberately separate from any fix agent so findings aren't rationalised away. Repo-scoped — never reaches outside this checkout. Use when the operator runs `/docs-audit`, says "audit the docs", "check the docs are accurate", "find doc drift", "verify documentation against code", or wants periodic doc hygiene. Also use when invoked from a scheduled job.
---

# Docs Audit

End-to-end audit of every Markdown doc in this repo for factual claims
that have drifted from code reality. The docs that drift in this kind
of repo are `CLAUDE.md`, `README.md`, and `docs/*.md` — files that make
load-bearing claims about scripts, env vars, file layout, and behaviour
which become stale as the code moves underneath them.

Designed to run interactively when an operator wants a hygiene pass, or
headlessly on a schedule.

## What this skill is _not_

- **Not a writing-style or readability checker.** T3 framing
  (motivation prose, headings, tone) is explicitly out of scope — see
  `references/claim-types.md`.
- **Not a fixer.** The audit agent produces a report of findings; a
  _separate_ agent (or a follow-up session) does the actual fix. Keeping
  audit and fix in different agents is the core discipline here — an
  agent that both finds and fixes will rationalise away findings to make
  its own fix easier, or quietly soften a "FAIL" into a "close enough".
  The audit's only job is to report reality accurately. Whatever does
  the fix reads the report fresh.
- **Not multi-repo.** Discovery is scoped to the current repo's working
  tree. References to anything outside this checkout are noted as
  external pointers but not resolved.

## Invocation

```
/docs-audit              # full repo, interactive
/docs-audit <path>       # scope to a file or subtree (e.g. CLAUDE.md, docs/)
```

When run from a scheduled / headless context there is no operator to
confirm anything — see "Headless / scheduled runs" below.

## The audit-≠-fix discipline

This is the load-bearing rule, so it gets its own section.

The agent that runs this skill is the **audit agent**. It is read-only:
it greps, reads, and lists; it does not edit docs, does not commit, does
not "tidy up while it's in there". Its single deliverable is the report.

Fixing the drift is a **separate pass** — a different agent, or a later
session, that opens the report and works through the findings. That
separation is what keeps the audit honest. An agent told to "audit and
fix" has an incentive to under-report (fewer findings = less work) and
to downgrade hard FAILs into soft "maybe". An agent told only to "audit"
has no such incentive — its success is measured by how accurately it
mirrors code reality, not by how little follow-up work it creates.

If you are running this skill, you are the audit agent. Do not fix
anything. Write the report and stop.

## The phases

The phases below are sequential — don't reorder. Each phase produces the
input the next one needs.

### Phase 1 — Discover the doc surface

Run the bundled discovery script:

```bash
.claude/skills/docs-audit/scripts/discover-docs.sh "$SCOPE"
```

Returns one path per line. **The script owns inclusion / exclusion
rules** (`node_modules`, `dist`, `.git`, `archive/`, generated trees,
etc.) — do not re-derive these inline. If the rules need adjustment,
edit the script's header comment and its prune list together; the
comment is the SSOT for _why_ each exclusion exists. Putting the
exclusions in the script (not in this skill) means scope tweaks are a
one-line edit with no skill rewrite.

Capture the file count. If discovery returns zero files, stop and report
— either the scope is wrong or the doc surface really is empty.

### Phase 2 — Extract claims (per file)

For each discovered file, walk the content and extract every claim that
matches a T1 or T2 type from `references/claim-types.md`. Skip T3
(framing, headings, tone).

**Method choice — separate agent vs inline.** Default to dispatching a
separate read-only agent for the per-file walk (see "Dispatch pattern"
below). A dispatched agent keeps its per-file `Read` / `grep` tool noise
out of the operator's context and returns only the structured triage
matrix. The exception is scheduled headless runs where there's no
operator context to protect — those can run inline.

For each claim, record:

- The exact claim text (one short paraphrase, ≤ 80 chars)
- The line number (or line range)
- The claim type (T1 sub-type or T2 sub-type)
- The verification target (file path, symbol name, regex pattern)

Output: a per-file claim list. Do not deduplicate across files — the
same claim made in two places is two findings (and may need fixing in
both).

### Phase 3 — Verify

For each **T1** claim, run the verification method named in
`references/claim-types.md` for its sub-type. Capture: `PASS`, `FAIL`,
or `N/A` (claim is genuinely unfalsifiable — rare, use sparingly).

For each **T2** claim, mark `REVIEW` and capture the file path the
reviewer would open. T2 is not auto-verifiable by design — it needs a
human (or a fix-pass agent) to read the code.

For `FAIL` rows, the report must include the **actual reality**, not
just "wrong". Whoever fixes the doc needs to know the correct value;
making them re-investigate from scratch is wasted work. Example: not
"line number is wrong" but "cited as `:309`; the symbol is at `:317`".

Off-by-one drift is the dominant T1 failure mode. When a line-number
citation fails, check ±10 lines for the cited symbol before declaring it
missing — the symbol probably moved, it didn't vanish.

### Phase 4 — Cross-cutting check

After per-file verification, scan for patterns that span files:

- **Same broken pointer in multiple places.** If a `FAIL` references a
  non-existent file or symbol, `grep -rn` for the same pointer across
  all discovered docs. Each additional hit is an additional finding —
  fixing one copy and missing the others is the classic regression.
- **Dead config / data files.** If discovery (or a doc) names a config
  or data file, grep the codebase for readers of it. Zero readers means
  a dead-config candidate — flag it.
- **Version-stamped or phase-stamped narrative.** Grep live docs for
  patterns like `v[0-9]+\.[0-9]+\.[0-9]+`, `Phase [0-9A-F]\b`, or
  `20[0-9]{2}-[0-9]{2}-[0-9]{2}`. Each hit is a candidate for
  staleness — a "shipped in vX" note outlives the thing it described.

These cross-cutting findings get their own section in the report; they
don't slot into a per-file row.

### Phase 5 — Generate the report

Render `assets/report-template.md` with the audit findings. Write to
`audits/docs-audit-<YYYY-MM-DD>.md` (use `date +%Y-%m-%d` for the date —
never invent a date from context). Create `audits/` if it doesn't exist.

If a report with the same date already exists (e.g. running twice in one
day), append `-N` (`-2`, `-3`, …) until the filename is unused. **Don't
overwrite** — historical audits are the only record of drift-accumulation
rate, and that rate is itself a signal (see "Why date-stamped reports"
below).

The report is the single source of truth for what the audit found.
Anything downstream (a fix pass, an issue, a follow-up commit) references
it back by filename.

## Dispatch pattern

For Phase 2, dispatch a read-only agent to do the per-file walk. Brief
template:

```
Walk every file in this list and produce a structured per-file
claim extraction:

<paste discovery output>

For each file:
1. Read it once.
2. Extract every T1 and T2 claim per
   .claude/skills/docs-audit/references/claim-types.md.
3. For each claim record: file path, line number, claim type,
   exact citation text (≤80 chars), verification target.
4. Mechanically verify each T1 (grep/Read/ls). Mark PASS / FAIL.
   For FAIL, the Notes column MUST include the actual reality.
5. For each T2: mark REVIEW + name the file to open.
6. Output as a single markdown table — no prose preamble.

Constraints:
- Read-only. No edits, no commits, no mutations of any kind.
- Skip T3 (framing prose, headings, tone) entirely.
- Aim for thoroughness — a long table is fine.
- Final output is just the table plus a tally line at the bottom.
```

The dispatched agent inherits the audit-≠-fix discipline: it is
read-only and returns findings, nothing more.

## Headless / scheduled runs

When invoked without an operator (e.g. via a scheduled job or cron), the
run must be fully autonomous:

- There is no confirmation gate to skip — the deliverable is the report,
  which is written unconditionally.
- Skip the separate-agent dispatch — run inline so the whole audit runs
  in one process tree.
- On any unrecoverable error, still write a partial report with what was
  audited so far plus an "Errors" section, and exit non-zero so the
  scheduler can flag the failure.

## Error handling — file-level

If reading a single file fails (permission, encoding, etc.), record the
error in the report's "Files skipped" section with the reason, and
continue. One bad file must not block the whole run.

If discovery returns zero files, stop and report — that's a scope
configuration problem, not a doc issue.

## Why each design choice

A few things here look optional but aren't.

**Why a separate discovery script.** Inclusion / exclusion rules are the
most likely thing to drift over time (new generated dirs, new archive
locations). Putting them in a script with a documented header lets the
rules evolve without a skill rewrite, and the script can be run and
tested independently.

**Why dispatch by default.** A full-repo audit reads every doc and runs
hundreds of greps. Without dispatching to a separate agent, that noise
floods the operator's context and degrades the rest of the session. The
dispatched agent returns only the structured matrix — a large reduction
in returned tokens.

**Why audit ≠ fix.** Repeated, this is the spine of the skill: an agent
that both finds and fixes is structurally incentivised to under-report.
Separation removes the incentive. The audit reports; a fresh pass fixes.

**Why date-stamped reports.** Drift-accumulation rate is itself a useful
signal. Running periodically and seeing 5 → 8 → 15 findings across three
audits tells you the doc surface is decaying faster than it's being
maintained. Overwriting that history erases the trend — keep every
report.
