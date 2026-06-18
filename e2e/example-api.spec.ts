import { test, expect } from '@playwright/test';

// Always-on (not gated). Hits the backend via the request fixture (baseURL from
// playwright.config.ts). The webServer boots the backend with tsx before this runs.
test('GET /api/health returns healthy', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, status: 'healthy' });
});
