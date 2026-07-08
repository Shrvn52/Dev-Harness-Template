/**
 * Architecture: a SHRINK-ONLY debt ratchet, counted PER OCCURRENCE. Every
 * first-party source file (backend/src, frontend/src, shared, tests helpers)
 * carrying `eslint-disable` directives must appear in the ALLOWLIST below with
 * its exact occurrence count. Counts may only shrink (clean a disable → lower
 * the count / drop the entry), never grow — a per-FILE allowlist would let an
 * allowlisted file accumulate unlimited new disables undetected.
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
const MARKER = /eslint-disable/g;

// Files permitted to carry eslint-disable directives, with their EXACT count.
// Shrink only — never raise a count or append an entry to silence a new
// violation. Each entry should be a DOCUMENTED exception.
//
// EMPTY is the goal state, and this repo is in it: zero disables anywhere.
// (The last one — route-error-handler's console.error fallback — was retired
// by wiring lib/logger.ts in. Retrofitting onto a codebase with existing debt?
// Seed this list from a scan and shrink from there.)
const ALLOWLIST: ReadonlyArray<{ file: string; count: number }> = [];

function rel(f: string): string {
  return relative(REPO_ROOT, f).split('\\').join('/');
}

// Every first-party source tree the ratchet watches. walkTs skips *.test.ts,
// so under tests/ only the shared helpers are scanned — a disable in shared
// test plumbing is debt like any other. e2e specs are *.spec.ts, so they ARE
// scanned: E2E code is first-party source, not a lint-free zone.
const SCAN_ROOTS = ['backend/src', 'frontend/src', 'shared', 'tests', 'e2e'];

describe('Architecture — eslint-disable ratchet (shrink-only, per-occurrence)', () => {
  // file → actual occurrence count, for every file containing the marker.
  const actual = new Map<string, number>(
    SCAN_ROOTS.flatMap((root) => walkTs(join(REPO_ROOT, ...root.split('/'))))
      .map((f) => [rel(f), (readFileSync(f, 'utf8').match(MARKER) ?? []).length] as const)
      .filter(([, n]) => n > 0),
  );
  const allowed = new Map(ALLOWLIST.map((e) => [e.file, e.count]));

  it('the scan sees real files (sanity floor — an empty walk would pass vacuously)', () => {
    const scanned = SCAN_ROOTS.flatMap((root) => walkTs(join(REPO_ROOT, ...root.split('/'))));
    expect(scanned.length).toBeGreaterThan(0);
  });

  it('no NEW debt: every file with an eslint-disable is on the allowlist', () => {
    const newDebt = [...actual.keys()].filter((f) => !allowed.has(f));
    expect(
      newDebt,
      `New eslint-disable outside the allowlist. Fix the lint issue — or, if genuinely justified, add { file, count } to ALLOWLIST with a rationale comment:\n  ${newDebt.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no GROWTH: no allowlisted file exceeds its allowed count', () => {
    const grown = [...actual.entries()]
      .filter(([f, n]) => allowed.has(f) && n > (allowed.get(f) ?? 0))
      .map(([f, n]) => `${f}: ${n} found, ${allowed.get(f)} allowed`);
    expect(
      grown,
      `An allowlisted file gained NEW eslint-disable directives — the per-file allowance is not a blank cheque. Fix the new lint issue instead of stacking disables:\n  ${grown.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no GHOST allowance: every allowlisted count is still fully used (shrink the list as you clean)', () => {
    const ghosts = ALLOWLIST.filter((e) => (actual.get(e.file) ?? 0) < e.count).map(
      (e) => `${e.file}: ${actual.get(e.file) ?? 0} found, ${e.count} allowed`,
    );
    expect(
      ghosts,
      `Allowlist counts exceed reality — the ratchet only shrinks, so lower these counts (or drop the entries) to bank the improvement:\n  ${ghosts.join('\n  ')}`,
    ).toEqual([]);
  });
});
