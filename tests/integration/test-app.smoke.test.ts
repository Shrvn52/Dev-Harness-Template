import { describe, it, expect } from 'vitest';
import { createTestApp } from './_helpers/test-app.js';

/**
 * The harness tests itself — proves buildApp() wires routes, setDb() injects the
 * in-memory DB with migrations applied, and the server binds. If createTestApp
 * regressed to returning an empty app, these assertions go red (non-vacuous).
 */
describe('test-app harness (smoke)', () => {
  it('serves the health route on the injected DB', async () => {
    const h = await createTestApp();
    try {
      const res = await fetch(`${h.baseUrl}/api/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, status: 'healthy' });

      const cols = h.db.prepare('PRAGMA table_info(items)').all();
      expect(cols.length).toBeGreaterThan(0);
    } finally {
      await h.cleanup();
    }
  });
});
