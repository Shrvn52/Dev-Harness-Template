import { defineConfig } from '@playwright/test';

// UI specs (e2e/ui/**) need a built frontend served by `vite preview`, so they're
// gated behind CC_INTEGRATION=1 (set by `npm run test:ui`). Plain `playwright test`
// runs only the always-on API specs without standing up Vite.
const UI_ENABLED = process.env.CC_INTEGRATION === '1';
const BACKEND_PORT = process.env.PORT ?? '8137';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${BACKEND_PORT}`,
    trace: 'retain-on-failure',
  },
  testIgnore: UI_ENABLED ? [] : ['**/ui/**'],
  webServer: [
    {
      command: `cd backend && PORT=${BACKEND_PORT} npx tsx src/index.ts`,
      port: Number(BACKEND_PORT),
      reuseExistingServer: true,
      timeout: 30_000,
      stdout: 'pipe',
    },
    ...(UI_ENABLED
      ? [
          {
            // --host 127.0.0.1 pins IPv4. Vite preview defaults to host 'localhost',
            // which on CI Linux / WSL2 can resolve to ::1 only — an IPv6 bind refuses
            // the IPv4 connect Playwright issues against 127.0.0.1, surfacing as
            // ERR_CONNECTION_REFUSED on every UI spec.
            command: 'cd frontend && npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
            port: 4173,
            reuseExistingServer: true,
            timeout: 30_000,
            stdout: 'pipe' as const,
          },
        ]
      : []),
  ],
});
