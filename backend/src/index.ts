import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { ROUTES } from './routes/registry.js';
import { routeErrorHandler } from './lib/route-error-handler.js';
import { PORT, HOST } from './config.js';

/**
 * Pure app factory — NO side effects at construct time (no DB open, no timers,
 * no subprocess, no port bind). THIS is the integration-test seam: a test calls
 * buildApp() with an injected in-memory DB (tests/integration/_helpers/test-app.ts)
 * and serve()s on a random port only when it chooses to. Keep it side-effect-free.
 */
export function buildApp(): Hono {
  const app = new Hono();
  app.onError(routeErrorHandler);
  for (const { path, app: routeApp } of ROUTES) {
    app.route(path, routeApp);
  }
  return app;
}

/** Boot entrypoint — binds the port. Only runs when this file is the process
 *  entry (not when imported by a test). console is allowed here (boot path). */
export function startServer(): void {
  const app = buildApp();
  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
    console.log(`[server] listening on http://${info.address}:${info.port}`);
  });
}

// Run only when invoked directly (`tsx src/index.ts` / `node dist/.../index.js`),
// never when imported by a test — keeps buildApp imports side-effect-free.
if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  startServer();
}
