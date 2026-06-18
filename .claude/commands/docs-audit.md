# Docs Audit

Invoke the `docs-audit` skill via the Skill tool to walk every Markdown
doc in this repo, verify load-bearing factual claims against code
reality, and write a date-stamped findings report.

## Arguments

- `$ARGUMENTS` (optional) — pass-through to the skill:
  - `<path>` — scope the audit to a file or subtree (e.g. `CLAUDE.md`,
    `README.md`, `docs/`). Omit to audit the whole repo.

## What the skill does

1. **Discover** the doc surface via
   `.claude/skills/docs-audit/scripts/discover-docs.sh` (the script owns
   its own exclusions — `node_modules`, `dist`, `.git`, `archive/`, etc.).
2. **Extract** T1 (mechanical) and T2 (behavioural) claims per
   `.claude/skills/docs-audit/references/claim-types.md`; skip T3 prose.
3. **Verify** T1 claims mechanically (grep / Read / ls); flag T2 for
   code-reading review.
4. **Report** findings to `audits/docs-audit-<YYYY-MM-DD>.md`, never
   overwriting an earlier dated report — so drift-accumulation rate stays
   visible across runs.

The audit is **read-only**. It finds drift; it does not fix it. Fixing is
a deliberately separate pass (different agent or later session) so the
audit has no incentive to rationalise findings away.

Repo-scoped — never touches anything outside the current checkout.
