import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside Next's server bundle; tests run route
      // handlers directly in Node, which is the server.
      'server-only': fileURLToPath(new URL('./src/test/empty.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Route tests share one SQLite file per worker; run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
