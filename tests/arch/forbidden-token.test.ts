/**
 * Architecture: ban a forbidden token outside a documented allowlist. Here the
 * token is FIXME — a finding ends fixed, tracked (issue), or dropped, never just
 * "marked". This file names the token to describe what it bans, so it is the one
 * allow-listed entry — demonstrating the escape hatch.
 *
 * Archetype: forbidden-token + allowlist. (`git grep` works once the repo is
 * initialised; we walk the FS so the test is green pre-`git init` too.)
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

// The forbidden token. Use a string built at runtime so this very line does not
// itself count as an occurrence.
const TOKEN = ['FIX', 'ME'].join('');
const ALLOWLIST = new Set(['tests/arch/forbidden-token.test.ts']);

// A walker that, unlike walk-ts.ts, INCLUDES *.test.ts — the marker most often
// hides in test files, so the scan must see them.
function walkAll(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkAll(full, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(full);
  }
  return out;
}

describe('Architecture — no forbidden tokens (FIXME)', () => {
  const files = ['backend/src', 'frontend/src', 'shared', 'tests'].flatMap((r) =>
    walkAll(join(REPO_ROOT, r)),
  );

  it('scans a non-empty file set (sanity floor)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it(`no ${TOKEN} outside the documented allowlist`, () => {
    const hits = files
      .map((f) => relative(REPO_ROOT, f).split('\\').join('/'))
      .filter((r) => !ALLOWLIST.has(r))
      .filter((r) => readFileSync(join(REPO_ROOT, r), 'utf8').includes(TOKEN));
    expect(hits, `${TOKEN} markers found — fix, file an issue, or drop them:\n  ${hits.join('\n  ')}`).toEqual([]);
  });
});
