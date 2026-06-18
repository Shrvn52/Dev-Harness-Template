/**
 * Architecture: forbid re-declaring a name already exported from `shared/`.
 *
 * Why: a name shared across the boundary must have ONE source. Two definitions
 * (e.g. a `STATUS_COLORS` in shared/ and another in frontend/) drift silently.
 * Re-exports (`export { X } from '@shared/...'`) are allowed — only fresh
 * declarations of the same identifier are flagged.
 *
 * Archetype: SSOT-boundary guard. Copy this and re-point the roots for any
 * "single source of truth" you want to enforce.
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { walkTs } from './_helpers/walk-ts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const EXPORT_PATTERNS = [
  /^export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^export\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^export\s+enum\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^export\s+interface\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  /^export\s+type\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
];

function extractExports(file: string): Set<string> {
  const names = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    for (const pat of EXPORT_PATTERNS) {
      const m = trimmed.match(pat);
      if (m && m[1]) names.add(m[1]);
    }
  }
  return names;
}

describe('Architecture — duplicate exports across the shared boundary', () => {
  const sharedFiles = walkTs(join(REPO_ROOT, 'shared'));
  const sharedNames = new Map<string, string>();
  for (const f of sharedFiles) {
    for (const n of extractExports(f)) sharedNames.set(n, f.replace(REPO_ROOT + '/', ''));
  }

  it('shared/ actually exports something (sanity floor — no vacuous pass)', () => {
    expect(sharedNames.size).toBeGreaterThan(0);
  });

  it('no name exported from shared/ is re-declared in backend/src or frontend/src', () => {
    const appFiles = [
      ...walkTs(join(REPO_ROOT, 'backend', 'src')),
      ...walkTs(join(REPO_ROOT, 'frontend', 'src')),
    ];

    const violations: string[] = [];
    for (const f of appFiles) {
      for (const name of extractExports(f)) {
        if (sharedNames.has(name)) {
          violations.push(
            `${f.replace(REPO_ROOT + '/', '')} re-declares '${name}' (already exported from ${sharedNames.get(name)})`,
          );
        }
      }
    }

    expect(
      violations,
      `Duplicate exports across the shared boundary:\n  ${violations.join('\n  ')}\n\nFix: import from shared/ instead of redeclaring.`,
    ).toEqual([]);
  });
});
