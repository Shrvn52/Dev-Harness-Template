# Docs Audit — {{DATE}}

**Scope:** {{SCOPE_DESCRIPTION}}
**Files audited:** {{FILE_COUNT}}

## Headline

{{T1_PASS}} T1 PASS · {{T1_FAIL}} T1 FAIL · {{T2_REVIEW}} T2 REVIEW

{{HEADLINE_VERDICT}}
<!-- e.g. "Doc surface is mostly accurate; <N> mechanical drift items
need fixing." or "Doc surface has significant drift; fix before next
release." -->

## Findings — T1 (mechanical)

| # | File | Line | Sub-type | Claim (paraphrase) | Status | Reality / Notes |
|---|---|---|---|---|---|---|
{{T1_ROWS}}
<!-- For every FAIL, the Reality column MUST state the correct value,
not just "wrong". -->

## Findings — T2 (behavioural, REVIEW)

| # | File | Line | Claim (paraphrase) | File to open for review |
|---|---|---|---|---|
{{T2_ROWS}}

## Cross-cutting findings

<!-- Patterns that span files, not specific to one row. Examples: the
same broken pointer in N places; a config/data file no code reads; a
version- or date-stamped note that has outlived what it described. -->

{{CROSS_CUTTING}}

## Files skipped

<!-- Files discovery surfaced but the audit could not read (permission,
encoding, etc.), with the reason. Empty if none. -->

{{FILES_SKIPPED}}

## Drift since last audit

<!-- Compare T1 FAIL count against the previous audits/docs-audit-*.md.
A rising count means the doc surface is decaying faster than it's being
maintained. This is the reason reports are date-stamped, not overwritten. -->

{{DRIFT_TREND}}

## Audit method

- Discovery: `.claude/skills/docs-audit/scripts/discover-docs.sh{{SCOPE_ARG}}`
- Claim categorisation: `.claude/skills/docs-audit/references/claim-types.md`
- Verification: mechanical (grep/Read/ls) for T1; flagged REVIEW for T2; T3 skipped
- This audit is read-only. Fixing the findings is a separate pass — the
  audit agent never edits docs, so it has no incentive to under-report.
