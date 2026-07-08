/**
 * Architecture: `setDb()` is a TEST-ONLY seam. `backend/src/db.ts` documents
 * "no production callers, no runtime guard by design" — this test IS the guard,
 * moved to where guards belong (CI, not runtime). Any reference to `setDb`
 * in first-party runtime source outside its declaration site fails the build.
 * Tests (under `tests/`) may use it freely — that's what it's for.
 *
 * Archetype: "declared seam with a fenced caller-set". Copy this for any
 * dangerous-by-design export (a raw query escape hatch, a cache-bust hook):
 * declare where it may be called from, fail on any caller outside the fence.
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { walkTs } from './_helpers/walk-ts.js';
import { stripComments } from './_helpers/strip-comments.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

// Runtime source trees the fence covers. tests/ is deliberately absent.
const SCAN_ROOTS = ['backend/src', 'frontend/src', 'shared'];

// The one place the identifier may legitimately appear in runtime source.
const DECLARATION_SITE = 'backend/src/db.ts';

function rel(f: string): string {
  return relative(REPO_ROOT, f).split('\\').join('/');
}

describe('Architecture — setDb() is a test-only seam', () => {
  it('the declaration site still declares it (sanity floor — no vacuous pass)', () => {
    const src = readFileSync(join(REPO_ROOT, DECLARATION_SITE), 'utf8');
    expect(/\bexport function setDb\b/.test(src)).toBe(true);
  });

  it('no runtime source outside db.ts references setDb', () => {
    // Comments are stripped first: prose like config.ts's "tests inject via
    // setDb()" doc-note must not trip the fence — only live code references do.
    const offenders = SCAN_ROOTS.flatMap((root) => walkTs(join(REPO_ROOT, ...root.split('/'))))
      .map(rel)
      .filter((f) => f !== DECLARATION_SITE)
      .filter((f) => /\bsetDb\b/.test(stripComments(readFileSync(join(REPO_ROOT, f), 'utf8'))));
    expect(
      offenders,
      `setDb is a test-only seam — production code must never call it (it swaps the live DB with no guard). Remove the reference, or inject via a constructor/config instead:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
