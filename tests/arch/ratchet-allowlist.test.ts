/**
 * Architecture: a SHRINK-ONLY debt ratchet. The set of first-party source files
 * (backend/src, frontend/src, shared, tests helpers) carrying an
 * `eslint-disable` directive must equal the ALLOWLIST below — it may
 * only shrink (clean a file → remove its entry), never grow (silence a new
 * disable → append). The three-way drift check enforces every failure mode.
 *
 * This is the single most valuable archetype for retrofitting onto an existing
 * codebase: point it at any existing debt marker (`any`, `@ts-expect-error`,
 * `TODO`, a legacy import) and the count can only go down. Copy and re-point.
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { walkTs } from './_helpers/walk-ts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const MARKER = 'eslint-disable';

// Files permitted to carry an eslint-disable. Shrink only — never append to
// silence a new violation. Each entry should be a DOCUMENTED exception.
const ALLOWLIST = ['backend/src/lib/route-error-handler.ts'];

function rel(f: string): string {
  return relative(REPO_ROOT, f).split('\\').join('/');
}

// Every first-party source tree the ratchet watches. walkTs skips *.test.ts,
// so under tests/ only the shared helpers are scanned — a disable in shared
// test plumbing is debt like any other.
const SCAN_ROOTS = ['backend/src', 'frontend/src', 'shared', 'tests'];

describe('Architecture — eslint-disable ratchet (shrink-only)', () => {
  const withMarker = SCAN_ROOTS.flatMap((root) => walkTs(join(REPO_ROOT, ...root.split('/'))))
    .filter((f) => readFileSync(f, 'utf8').includes(MARKER))
    .map(rel);

  it('the allowlist is non-empty (sanity floor — the 3-way check runs against real data)', () => {
    expect(ALLOWLIST.length).toBeGreaterThan(0);
  });

  it('no NEW debt: every file with an eslint-disable is on the allowlist', () => {
    const newDebt = withMarker.filter((f) => !ALLOWLIST.includes(f));
    expect(
      newDebt,
      `New eslint-disable outside the allowlist. Fix the lint issue — or, if genuinely justified, add the file to ALLOWLIST with a rationale comment:\n  ${newDebt.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no GHOST entries: every allowlisted file still contains an eslint-disable', () => {
    const ghosts = ALLOWLIST.filter((f) => !withMarker.includes(f));
    expect(
      ghosts,
      `Allowlist entries no longer contain an eslint-disable — the ratchet only shrinks, so REMOVE them:\n  ${ghosts.join('\n  ')}`,
    ).toEqual([]);
  });
});
