/**
 * Architecture: the two route-construction conventions that lint can't express
 * as an AST selector become fitness tests here, so `/review-pr` can honestly
 * list them under "covered mechanically":
 *
 *  1. Mutation input enters through `zValidator(...)` + `c.req.valid(...)` —
 *     never a hand-rolled `c.req.json()` (different error shape, shallower
 *     validation, untyped body).
 *  2. Routers come from `createRouter()` (typed-error handler pre-attached) —
 *     a bare `new Hono()` silently drops error mapping when a route file is
 *     tested directly. Only the factory itself and the top-level app builder
 *     may construct Hono.
 *
 * Archetype: convention-as-regex over comment-stripped source. Copy this when a
 * review nit recurs and no lint selector fits (the promotion loop, CLAUDE.md →
 * Conventions).
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { walkTs } from './_helpers/walk-ts.js';
import { stripComments } from './_helpers/strip-comments.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const rel = (f: string): string => relative(REPO_ROOT, f).split('\\').join('/');
const src = (f: string): string => stripComments(readFileSync(f, 'utf8'));

// Files allowed to construct a Hono instance directly. Everything else uses
// createRouter() so the typed-error handler is attached in every path.
const HONO_FACTORY_ALLOWLIST = new Set([
  'backend/src/lib/hono-app.ts', // createRouter() itself
  'backend/src/index.ts', // buildApp() — the top-level composition root
]);

describe('Architecture — route construction conventions', () => {
  const backendFiles = walkTs(join(REPO_ROOT, 'backend/src'));
  const routeFiles = backendFiles.filter((f) => rel(f).startsWith('backend/src/routes/'));

  it('scans a non-empty route set (sanity floor)', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it('no hand-parsed request bodies in routes/ — use zValidator + c.req.valid', () => {
    const hits = routeFiles.filter((f) => /\.req\.json\s*\(/.test(src(f))).map(rel);
    expect(
      hits,
      `Hand-rolled body parsing found — validate with zValidator('json', schema, zodErrorHook) and read via c.req.valid('json'):\n  ${hits.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no bare `new Hono()` outside the factory and the composition root', () => {
    const hits = backendFiles
      .filter((f) => !HONO_FACTORY_ALLOWLIST.has(rel(f)))
      .filter((f) => /new\s+Hono\s*[(<]/.test(src(f)))
      .map(rel);
    expect(
      hits,
      `Bare Hono construction found — use createRouter() from lib/hono-app.ts so routeErrorHandler is attached:\n  ${hits.join('\n  ')}`,
    ).toEqual([]);
  });

  it('the allowlisted factory really constructs Hono (sanity floor — allowlist is not stale)', () => {
    for (const allowed of HONO_FACTORY_ALLOWLIST) {
      expect(
        /new\s+Hono\s*[(<]/.test(src(join(REPO_ROOT, allowed))),
        `${allowed} is allowlisted for \`new Hono()\` but no longer constructs one — prune the allowlist`,
      ).toBe(true);
    }
  });
});
