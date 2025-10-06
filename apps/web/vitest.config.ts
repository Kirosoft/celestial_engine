import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'lib/**/__tests__/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // Default to node for fast pure unit tests, elevate TSX (React) tests to jsdom automatically
    environment: 'node',
    environmentMatchGlobs: [
      ['test/**/*.test.tsx', 'jsdom']
    ],
    setupFiles: ['./vitest.setup.ts']
  }
});
