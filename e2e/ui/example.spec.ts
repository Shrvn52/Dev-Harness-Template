import { test, expect } from '@playwright/test';

// Flag-gated: runs only under CC_INTEGRATION=1 (`npm run test:ui`), because it
// needs the built frontend served by `vite preview` on 4173. Run `npm run build`
// first. Navigate to the preview server explicitly (the API baseURL is a
// different port).
const PREVIEW_URL = 'http://127.0.0.1:4173/';

test('app shell renders the Items heading', async ({ page }) => {
  await page.goto(PREVIEW_URL);
  await expect(page.getByRole('heading', { name: /items/i })).toBeVisible();
});
