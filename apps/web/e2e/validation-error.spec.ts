import { test, expect } from '@playwright/test';
import { resetRepoRoot } from './helpers';

test.beforeEach(async () => { await resetRepoRoot(); });

test('validation error missing type', async ({ request }) => {
  const res = await request.post('/api/nodes', { data: { name: 'NoType' }});
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe('missing_type');
});
