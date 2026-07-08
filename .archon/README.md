# `.archon/` — data-driven review invariants

This directory ships one idea — **review rules as data, not code** — plus
workflow skeletons that automate it with the
[Archon](https://github.com/coleam00/archon) runner.

It is part of the harness, with a deliberate split:

- **`invariants.yaml` is runner-agnostic harness data.** The `/review-pr`
  command loads it natively (no Archon needed): rules whose `trigger_paths`
  match a PR's changed files get their own reviewer. Keep this file even if
  you never install Archon.
- **`workflows/` requires the external Archon CLI** on `PATH`. It automates the
  same data file into standalone review/implement DAGs. Don't use Archon?
  Delete `workflows/` alone — the invariants keep working through `/review-pr`.

---

## The one idea: invariants as data, not code

The template's conventions come in tiers (CLAUDE.md → Conventions): mechanical
rules live in lint selectors and arch tests, and the promotion loop pushes
recurring review nits down into them. But some contracts can NEVER be
mechanical — "does this error message reveal too much?" is permanently a
judgment call. Those rules live here, as data.

`invariants.yaml` is a flat list of review rules. Each row pairs a set of
`trigger_paths` (globs) with a `rule` (the contract a reviewer must enforce) and
a `reason` (the failure mode if the rule is broken).

Review flows **read this file at runtime** (`cat .archon/invariants.yaml`),
match each invariant's `trigger_paths` against the files a PR changed, and fan
out a reviewer only for the invariants that actually fire. Nothing is hardcoded
into the workflow or the command.

**The payoff:** enforcing a _new_ review rule is a **one-line append** to
`invariants.yaml`. No workflow edit, no command edit, no redeploy. The next
review run `cat`s the file and the new rule auto-enrolls across every consumer.

```yaml
# Append this row and the next review run enforces it — zero workflow changes:
- id: my-new-rule
  trigger_paths: ["backend/src/**/*.ts"]
  rule: "..."
  reason: "..."
  severity: important
```

For anything a linter or arch test _can_ catch, prefer the linter (the
promotion loop): invariants are only for the judgment calls.

---

## Files in this directory

| File                        | Purpose                                                            | How you maintain it                                         |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `invariants.yaml`           | The review-rule list (the SSOT). Read by `/review-pr` + workflows. | Append a row per new rule.                                  |
| `subsystems.yaml`           | Subsystem taxonomy placeholder.                                    | Edit to match your code; mirror into `.github/labels.yml`.  |
| `config.yaml`               | Provider/model defaults for the Archon workflows.                  | Edit the default model tier.                                |
| `workflows/review-pr.yaml`  | Archon skeleton: load invariants → classify → conditional review.  | Adapt reviewer prompts to your stack.                       |
| `workflows/issue-to-pr.yaml`| Archon skeleton: issue → preload invariants → implement → review.  | Adapt the implement/verify nodes to your toolchain.         |

The workflow files are **starting points**, not finished pipelines. They carry no
domain knowledge about this template — wire your own reviewer prompts and verify
commands into them before relying on the output.

---

## Using the Archon runner (optional automation)

```bash
# Validate the YAML shapes against your installed Archon:
archon validate workflows

# Run a review against a PR:
archon workflow run review-pr <PR-number>
```

If `archon` is not installed, the workflows are inert — but `invariants.yaml`
still does its job every time `/review-pr` runs.
