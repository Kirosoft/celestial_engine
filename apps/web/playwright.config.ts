import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'crypto';
import { resolve } from 'path';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  expect: { timeout: 5000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: process.platform === 'win32'
      ? 'npm run dev:e2e'
      : 'REPO_ROOT=.e2e-root npm run dev',
    url: 'http://localhost:3000/api/nodes',
    reuseExistingServer: !process.env.CI,
    cwd: process.cwd()
  }
});
