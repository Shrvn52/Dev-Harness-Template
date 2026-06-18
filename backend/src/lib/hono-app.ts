import { Hono } from 'hono';
import { routeErrorHandler } from './route-error-handler.js';

/**
 * Factory for sub-route Hono instances with the typed-error handler pre-attached.
 *
 * Why: Hono's onError is per-app, not inherited. A route mounted via
 * `app.route('/api/x', xRoutes)` uses the parent's onError when handlers throw,
 * but a test that calls `xRoutes.request(...)` directly bypasses the parent.
 * Attaching `routeErrorHandler` here keeps typed-error → status mapping identical
 * in both paths.
 *
 * Convention: every `routes/*.ts` does `const app = createRouter()` and
 * `export default app`. The registry-coverage arch test relies on it.
 */
export function createRouter(): Hono {
  const app = new Hono();
  app.onError(routeErrorHandler);
  return app;
}
