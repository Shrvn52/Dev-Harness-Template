#!/usr/bin/env bash
# discover-docs.sh — list every in-scope Markdown file in the repo, one per line.
#
# This script OWNS the inclusion / exclusion rules. They live here, not in
# SKILL.md, so future scope tweaks are a one-line edit with no skill rewrite.
# When you change the prune list, update this header comment too — the comment
# is the SSOT for *why* each exclusion exists.
#
# Inclusion: every tracked or untracked .md file under the repo root.
# Exclusions (generic — should hold for any stack):
#   - node_modules/        — third-party deps, not our docs
#   - .git/                — git internals
#   - dist/, build/, out/, coverage/ — generated/build trees
#   - archive/ (at any depth) — historical/frozen content, intentionally stale
#                               (this is what the repo-root .ignore convention
#                               also protects; mirrored here so the script is
#                               self-contained and not dependent on ripgrep)
#   - audits/              — output of THIS skill, not input to it
#   - test-results/, playwright-report/ — test runner artifacts
#   - CHANGELOG.md         — append-only release log; rewriting it is wrong
#
# Untracked .md files are included on purpose (via `find`, not `git ls-files`):
# drift can land in WIP docs the author hasn't committed yet.
#
# A scope override may be passed as $1 (a relative path or glob); when given,
# discovery is restricted to that path. Used by `/docs-audit <path>` to audit a
# single file or subtree without rewalking the whole repo.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT" || exit 1

SCOPE="${1:-.}"

find "$SCOPE" \
  -type d \( \
    -name node_modules -o \
    -name .git -o \
    -name dist -o \
    -name build -o \
    -name out -o \
    -name coverage -o \
    -name audits -o \
    -name test-results -o \
    -name playwright-report -o \
    -name archive \
  \) -prune \
  -o -type f -name '*.md' ! -name 'CHANGELOG.md' -print \
  | sort
