import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Frontend tier: jsdom. shared/ is imported relatively, so no alias config here
// (see the note in vite.config.ts).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
