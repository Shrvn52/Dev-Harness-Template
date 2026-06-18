---
description: Fresh-context PR or working-tree review — fans out specialized reviewers in parallel.
argument-hint: [review-aspects | pr-number]
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task"]
---

# Fresh-Context PR Review

Run a fresh-context review of a PR — or, when no PR exists, of the uncommitted working-tree diff — by fanning out specialized reviewers **in parallel**.

**Principle:** the session that wrote the code should NOT be the session that reviews it. Run this command in a fresh `claude` session (or `/clear` first) so reviewers aren't primed by the implementer's reasoning. Fresh context, no sycophancy, different blind spots.

**Review Aspects (optional):** `$ARGUMENTS` — if blank or a bare number, run every applicable reviewer; if word tokens (e.g. `errors tests`), narrow to those reviewers.

## Workflow

### 1. Identify the diff (three-layer fallback)

Try in order, stop at first hit:

1. **Explicit PR number** — if `$ARGUMENTS` is a bare integer:
   ```bash
   gh pr view <N> --json number,url,title,headRefName,body,files
   gh pr diff <N>
   ```
2. **Branch's PR** — if no number passed:
   ```bash
   gh pr view --json number,url,title,headRefName,body,files 2>/dev/null
   ```
3. **Working-tree fallback** — if no PR resolves:
   ```bash
   git diff origin/main...HEAD     # committed but unpushed/no-PR
   git status --short              # uncommitted/untracked
   ```
4. If even (3) is empty (clean tree on `main`), output `No diff to review.` and stop.

Note the changed files + the high-level intent (PR body, last commit message, or — for working-tree — the user's session context).

### 2. Decide which reviewers apply

Based on the diff content and any explicit narrowing in `$ARGUMENTS`:

| Reviewer | When | Dispatch via |
|---|---|---|
| **Correctness pass** | Always | `Task` tool — a general-purpose subagent asked to hunt logic bugs, contract mismatches, and regressions in the diff |
| **`silent-failure-hunter`** | Diff contains `try`/`catch`/`Promise`/`.catch(`/`throw`/error-handler patterns | `Task` tool |
| **`pr-test-analyzer`** | Diff touches `tests/**`, `*.test.ts`, `*.spec.ts`, `e2e/**` | `Task` tool |
| **`code-simplifier`** | Always (advisory polish pass) | `Task` tool |

If `$ARGUMENTS` includes specific keywords (`errors`, `tests`, `simplify`, `correctness`), narrow to only those reviewers.

### 3. Fan out in parallel

**Single message, multiple `Task` calls.** Dispatch all applicable subagents together so they run concurrently. Each Task receives:

- The list of changed files
- A 1-paragraph PR/branch intent summary (from PR body, commit message, or session context)
- An instruction to focus on the diff, not the rest of the repo
- A reminder that critical issues must reference `file:line`

Sequential is wrong here — same signal, slower.

### 4. Aggregate

Collect outputs into a single report:

```markdown
# PR Review — <pr-title or branch-name or "Working tree">

## Critical (must fix before merge / commit)
- [reviewer-name] <issue> — `file.ts:42`

## Important (should fix)
- [reviewer-name] <issue> — `file.ts:87`

## Suggestions
- [reviewer-name] <suggestion> — `file.ts:120`

## Strengths
- <what the diff did well>

## Verdict
APPROVE | APPROVE_WITH_CHANGES | REQUEST_CHANGES
```

Cite `file:line` for every finding. Trivial diffs (docs-only, single-line, comment-only) get `APPROVE` with zero findings — do not fabricate issues.

## DO NOT FLAG — covered by lint or arch tests

This template enforces these mechanically. Flagging them here produces duplicate noise and risks suggesting fixes that violate the lint rule. Verify the rule still exists (`npm run lint`, `eslint.config.*`, `tests/arch/`) before deferring to it.

- **Typed errors**: lint bans `throw new Error(...)` in `backend/src/**` — code throws the typed errors from `backend/src/lib/errors.ts`. Don't suggest swapping typed errors back to plain `Error`.
- **Mutation input validation**: routes parse input via `zValidator` + the shared `zodErrorHook`, not hand-rolled `await c.req.json()`. Lint enforces.
- **`node:` prefix imports**: lint enforces in `backend/src/**`.
- **Router factory**: routes use `createRouter()` rather than a bare `new Hono()`.
- **Duplicate `shared/` exports**: covered by `tests/arch/no-duplicate-shared-exports.test.ts`.

This command is for the working-tree gap and judgment-level findings — not for re-litigating what CI already gates.

## Usage

```
/review-pr
# Full review with every applicable reviewer on PR (current branch) or working tree.

/review-pr 225
# Review a specific PR number.

/review-pr errors tests
# Narrow to silent-failure-hunter + pr-test-analyzer only.

/review-pr simplify
# Polish-only pass via code-simplifier.
```

## Notes

- **Parallel is the default.** Sequential defeats the point — same signal, slower.
- The reviewer subagents are described in `.claude/agents/` — each has its own system prompt and tool access.
- Keep critical findings actionable: `file:line` + one sentence + suggested fix. Vague complaints get ignored.
- **No fixes applied** — review only. Keeping review independent of implementation prevents reviewer-as-implementer bias; if the user wants fixes auto-applied, that belongs in a separate command.
