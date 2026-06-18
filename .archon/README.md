# `.archon/` — optional data-driven review invariants

> **This directory is OPTIONAL and inert without an external runtime.**
> Nothing here runs on its own. The workflows under `workflows/` are
> [Archon](https://github.com/anthropics/archon) DAGs and require the Archon
> CLI installed and on `PATH`. If you don't use Archon, **delete this entire
> directory** — `rm -rf .archon/`. Removing it costs you nothing else in the
> template; no other code reads these files.

This is a *thin* module. It ships one idea — **data-driven review invariants** —
and a couple of generic workflow skeletons to consume them. It deliberately does
**not** include SHA-pinning, sync tooling, fork discipline, or label management.

---

## The one idea: invariants as data, not code

`invariants.yaml` is a flat list of review rules. Each row pairs a set of
`trigger_paths` (globs) with a `rule` (the contract a reviewer must enforce) and
a `reason` (the failure mode if the rule is broken).

Review workflows **read this file at runtime** (`cat .archon/invariants.yaml`),
match each invariant's `trigger_paths` against the files a PR changed, and fan
out a reviewer only for the invariants that actually fire. Nothing is hardcoded
into the workflow.

**The payoff:** enforcing a *new* review rule is a **one-line append** to
`invariants.yaml`. No workflow edit, no code change, no redeploy. The next time a
review workflow runs, it `cat`s the file and the new rule auto-enrolls across
every workflow that loads invariants.

```yaml
# Append this row and the next review run enforces it — zero workflow changes:
  - id: my-new-rule
    trigger_paths: ["backend/src/**/*.ts"]
    rule: "..."
    reason: "..."
    severity: important
```

This is most valuable for **review-only** contracts — rules a linter or type
checker *cannot* express (e.g. "error messages must not leak internal file
paths"). For anything a linter *can* catch, prefer the linter; invariants are for
the judgment calls.

---

## Files in this directory

| File | Purpose | How you maintain it |
|---|---|---|
| `invariants.yaml` | The review-rule list (the SSOT). | Append a row per new rule. |
| `subsystems.yaml` | Subsystem taxonomy placeholder. | Edit to match your code; mirror into `.github/labels.yml`. |
| `config.yaml` | Provider/model defaults for the workflows. | Edit the default model tier. |
| `workflows/review-pr.yaml` | Skeleton: load invariants → classify triggers → conditionally review. | Adapt reviewer prompts to your stack. |
| `workflows/issue-to-pr.yaml` | Skeleton: issue → preload invariants → implement → self-review. | Adapt the implement/verify nodes to your toolchain. |

The workflow files are **starting points**, not finished pipelines. They carry no
domain knowledge about this template — wire your own reviewer prompts and verify
commands into them before relying on the output.

---

## Using it (only if you have Archon)

```bash
# Validate the YAML shapes against your installed Archon:
archon validate workflows

# Run a review against a PR:
archon workflow run review-pr <PR-number>
```

If `archon` is not installed, none of the above works — and that's fine. Delete
the directory and move on.
