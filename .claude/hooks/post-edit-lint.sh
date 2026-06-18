#!/usr/bin/env bash
# PostToolUse hook for Edit/Write/MultiEdit on TS files.
# Runs eslint on the changed file from the repo root (where eslint + the flat
# config live; the config's `files` globs select the right rules per path).
# Exit 2 + stderr surfaces lint errors to Claude, which self-fixes before moving
# on — so convention violations are caught as written, not after they pile up.
#
# Every unexpected condition is a NO-OP (exit 0), never a spurious block:
#   - jq missing, schema mismatch, file outside a repo, non-TS file,
#     eslint not installed (fresh clone before `npm install`).

set -uo pipefail

PAYLOAD=$(cat)
if ! command -v jq >/dev/null 2>&1; then
  # jq drives payload parsing, so without it this hook is silently inert — the user
  # believes lint is active when it isn't. Surface that ONCE per session, then no-op.
  # $PPID is stable here: CC spawns every PostToolUse hook as a child of the single
  # long-lived `claude` process, so the sentinel fires once-per-session, not per-edit.
  # (Don't switch the key to session_id — parsing it needs jq, which is what's missing.)
  SENTINEL="/tmp/cc-lint-hook-warned.$PPID"
  if [[ ! -e "$SENTINEL" ]]; then
    echo "[hook: post-edit-lint] jq not found — the post-edit lint hook is inert this session; inline lint feedback is OFF. Install jq to re-enable it." >&2
    : > "$SENTINEL" 2>/dev/null || true
  fi
  exit 0
fi

FILE=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[[ -z "$FILE" ]] && exit 0
[[ ! -f "$FILE" ]] && exit 0
[[ "$FILE" =~ \.(ts|tsx)$ ]] || exit 0
case "$FILE" in
  */node_modules/*|*/dist/*|*/build/*|*/coverage/*) exit 0 ;;
esac

REPO=$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null)
[[ -z "$REPO" ]] && exit 0
[[ -d "$REPO/node_modules/eslint" ]] || exit 0

LINT=$(cd "$REPO" && npx --no-install eslint "$FILE" 2>&1) || {
  cat >&2 <<EOF
[hook: post-edit-lint] ESLint errors in ${FILE#"$REPO"/}:

$LINT

These conventions are CI-blocking (see eslint.config.mjs + CLAUDE.md → Conventions).
Fix before the next iteration.
EOF
  exit 2
}

exit 0
