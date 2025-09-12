import { test, expect } from '@playwright/test';
import { resetRepoRoot, readJson } from './helpers';
import { join } from 'path';
import { promises as fs } from 'fs';

// The dev server (Next) started via playwright.config webServer.

test.beforeEach(async () => { await resetRepoRoot(); });

test('node CRUD and index update', async ({ request }) => {
  // Create node
  const createRes = await request.post('/api/nodes', { data: { type: 'Task', name: 'A1', props: { title: 'A1 title' } }});
  expect(createRes.status()).toBe(201);
  const node = (await createRes.json()).node;
  // List nodes (triggers integrity scan)
  const listRes = await request.get('/api/nodes');
  const listJson = await listRes.json();
  expect(listJson.nodes.length).toBe(1);
  // Update props
  const putRes = await request.put(`/api/nodes/${node.id}`, { data: { props: { title: 'A1 title', v: 2 } }});
  expect(putRes.status()).toBe(200);
  const updated = (await putRes.json()).node;
  expect(updated.props.v).toBe(2);
  // Rename
  const renameRes = await request.post(`/api/nodes/${node.id}/rename`, { data: { newId: node.id + '_r' }});
  expect(renameRes.status()).toBe(200);
  const renamed = (await renameRes.json()).node;
  // Position update
  const posRes = await request.post(`/api/nodes/${renamed.id}/position`, { data: { x: 77, y: 99 }});
  expect(posRes.status()).toBe(200);
  // Delete
  const delRes = await request.delete(`/api/nodes/${renamed.id}`);
  expect(delRes.status()).toBe(204);
  const notFound = await request.get(`/api/nodes/${renamed.id}`);
  expect(notFound.status()).toBe(404);
  // FS assertions
  const root = process.env.REPO_ROOT!;
  const files = await fs.readdir(join(root, 'nodes')).catch(()=>[]);
  expect(files.length).toBe(0);
  const index = await readJson(join(root, '.awb', 'index.json'));
  expect(index.nodes.length).toBe(0);
});
