import { defineConfig } from '@playwright/test';

// We keep a minimal globalSetup only to ensure test workers inherit REPO_ROOT (not for cleaning).
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 0,
  reporter: 'list',
  globalSetup: require.resolve('./e2e/global-setup'),
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    // Run preparation script first (cleans + copies schemas), THEN start Next with REPO_ROOT set.
    command: process.platform === 'win32'
      ? 'set E2E=1&& set PW_TEST=1&& set REPO_ROOT=.e2e-root&& node scripts\\prepare-e2e.js && next dev'
      : 'E2E=1 PW_TEST=1 REPO_ROOT=.e2e-root node scripts/prepare-e2e.js && E2E=1 PW_TEST=1 REPO_ROOT=.e2e-root next dev',
    url: 'http://localhost:3000/api/nodes',
  reuseExistingServer: false,
    cwd: process.cwd()
  }
});
