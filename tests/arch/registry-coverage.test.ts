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
import { ROUTES } from '../../backend/src/routes/registry.js';

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
});
