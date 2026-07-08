/**
 * Architecture: the route registry is the single source of truth for mounted
 * routes. Every entry must expose a real router and a unique, `/api/`-prefixed
 * path. Importing the registry already proves the backing files exist (a missing
 * import would throw here).
 *
 * Archetype: file↔registry coverage. Copy this for any "registered list that
 * must stay complete and consistent" (migrations, providers, feature flags).
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { ROUTES } from '../../backend/src/routes/registry.js';
import { stripComments } from './_helpers/strip-comments.js';

describe('Architecture — route registry coverage', () => {
  it('the registry is non-empty (sanity floor — no vacuous pass)', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('every route path is unique', () => {
    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('every route path is a non-empty /api/* path', () => {
    for (const r of ROUTES) expect(r.path).toMatch(/^\/api\/[a-z][a-z0-9/-]*$/);
  });

  it('every registered route exposes a Hono fetch handler', () => {
    for (const r of ROUTES) expect(typeof r.app.fetch).toBe('function');
  });

  // Reverse direction: every router file under routes/ must be registered. The
  // forward checks above can't see a new routes/foo.ts that nobody added to ROUTES —
  // it stays green and silently unmounted. Read registry.ts SOURCE (the imported
  // ROUTES array holds /api/* URLs, not filenames). Convention this enforces:
  // routes/ holds ONLY router files — move non-router helpers to lib/.
  it('every router file under routes/ is imported by the registry', () => {
    // cwd-independent anchoring — `npm test` runs from cwd: backend, so a
    // cwd-relative readdir would read the wrong dir; resolve from this file.
    const here = dirname(fileURLToPath(import.meta.url)); // tests/arch/
    const routesDir = resolve(here, '..', '..', 'backend/src/routes');
    // Strip comments before matching — a commented-out import must count as
    // UNregistered, not sneak past the regex below (see the helper's caveats).
    const src = stripComments(readFileSync(join(routesDir, 'registry.ts'), 'utf8'));
    const files = readdirSync(routesDir).filter((f) => f.endsWith('.ts') && f !== 'registry.ts');
    expect(files.length).toBeGreaterThan(0); // sanity floor — no vacuous pass
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const f of files) {
      const base = f.replace(/\.ts$/, '');
      // Match the `.js` import specifier (registry.ts uses NodeNext ESM imports —
      // './health.js', never './health.ts'). Quote-anchored to avoid a base that is
      // a substring of another registered import matching by accident.
      const re = new RegExp(`['"]\\./${esc(base)}\\.js['"]`);
      expect(
        re.test(src),
        `routes/${f} exposes a router but is not registered in ROUTES — add it, or move non-router helpers to lib/`,
      ).toBe(true);
    }
  });
});
