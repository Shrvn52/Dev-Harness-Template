import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `shared/` is imported RELATIVELY (`../../shared/types`) — the same style the
// backend uses. No alias: an alias must be declared in every resolver that ever
// touches the import (vite, vitest, tsc), and each declaration is a place to
// drift. Relative paths resolve identically everywhere for free.
//
// Both proxies read PORT so `PORT=9000 npm run dev:backend` keeps the frontend
// working — the same env var the backend and Playwright honour.
const backend = `http://127.0.0.1:${process.env.PORT ?? '8137'}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': backend },
  },
  preview: {
    port: 4173,
    proxy: { '/api': backend },
  },
});
