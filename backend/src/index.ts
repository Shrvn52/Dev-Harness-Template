import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { argv, cwd } from 'node:process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES } from './routes/registry.js';
import { routeErrorHandler } from './lib/route-error-handler.js';
import { getDb } from './db.js';
import { PORT, HOST, DB_PATH } from './config.js';

/**
 * Pure app factory — NO side effects at construct time (no DB open, no timers,
 * no subprocess, no port bind). THIS is the integration-test seam: a test calls
 * buildApp() with an injected in-memory DB (tests/integration/_helpers/test-app.ts)
 * and serve()s on a random port only when it chooses to. Keep it side-effect-free.
 */
export function buildApp(): Hono {
  const app = new Hono();
  app.onError(routeErrorHandler);
  // Unknown paths get the same wire shape as every other failure — one JSON
  // error contract, no text/plain surprises for API clients.
  app.notFound((c) => c.json({ error: 'not found' }, 404));
  for (const { path, app: routeApp } of ROUTES) {
    app.route(path, routeApp);
  }
  return app;
}

/** Locate frontend/dist by walking up from this module — works from both the
 *  tsx source tree (backend/src) and the tsc-emitted tree (backend/dist/backend/src),
 *  whose depths differ. Returns null when no build exists (API-only mode). */
function findFrontendDist(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'frontend', 'dist');
    if (existsSync(join(candidate, 'index.html'))) return candidate;
    dir = dirname(dir);
  }
  return null;
}

/** The minimal ship path: `npm run build && npm start` serves the whole app on
 *  one port. Static files ride BEHIND the API routes (registration order), and
 *  the SPA fallback explicitly skips /api/* so the JSON 404 contract holds. */
function mountStatic(app: Hono, distDir: string): void {
  const root = relative(cwd(), distDir); // serveStatic resolves root from cwd
  const spaFallback = serveStatic({ root, path: 'index.html' });
  app.use('*', serveStatic({ root }));
  app.get('*', (c, next) => {
    if (c.req.path.startsWith('/api/')) return next();
    return spaFallback(c, next);
  });
}

/** Boot entrypoint — binds the port. Only runs when this file is the process
 *  entry (not when imported by a test). console is allowed here (boot path). */
export function startServer(): void {
  // Fail LOUD at boot, not on first request: getDb() opens (and migrates) the
  // DB now, so a broken DB_PATH crashes the process instead of booting a server
  // whose /api/health lies "healthy" while every data route 500s.
  getDb();
  const app = buildApp();
  const frontendDist = findFrontendDist();
  if (frontendDist) {
    mountStatic(app, frontendDist);
  }
  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
    console.log(`[server] listening on http://${info.address}:${info.port} (db: ${DB_PATH})`);
    console.log(
      frontendDist
        ? `[server] serving frontend from ${frontendDist}`
        : '[server] no frontend/dist build found — API only (run `npm run build` to serve the UI)',
    );
  });
}

// Run only when invoked directly (`tsx src/index.ts` / `node dist/.../index.js`),
// never when imported by a test — keeps buildApp imports side-effect-free.
// Compare REALPATHS: Node resolves the ESM entry's import.meta.url through
// symlinks but leaves argv[1] as invoked, so a symlinked entry (a deploy-style
// `current/` dir, an npm link) would otherwise exit 0 with no server and no
// error — the worst failure shape a fail-loud template can ship.
function isDirectRun(): boolean {
  if (!argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(argv[1]);
  } catch {
    return false; // argv[1] not a resolvable path → we were imported, not executed
  }
}

if (isDirectRun()) {
  startServer();
}
