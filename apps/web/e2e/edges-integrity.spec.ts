import { test, expect } from '@playwright/test';
import { resetRepoRoot, readJson } from './helpers';

async function createTask(request: any, name: string){
  const res = await request.post('/api/nodes', { data: { type: 'Task', name, props: { title: name+' title' } } });
  return (await res.json()).node;
}

test.beforeEach(async () => { await resetRepoRoot(); });

test('edge add/update/delete and cycle rejection with integrity repair', async ({ request }) => {
  const a = await createTask(request, 'A');
  const b = await createTask(request, 'B');
  const c = await createTask(request, 'C');
  const addAB = await request.post('/api/edges', { data: { sourceId: a.id, targetId: b.id, kind: 'flow' }});
  expect(addAB.status()).toBe(201);
  const edgeId = (await addAB.json()).edge.id;
  // Update edge kind
  const upd = await request.put(`/api/edges/${a.id}/${edgeId}`, { data: { kind: 'data' }});
  expect(upd.status()).toBe(200);
  // Add chain and attempt cycle
  await request.post('/api/edges', { data: { sourceId: b.id, targetId: c.id }});
  const cyc = await request.post('/api/edges', { data: { sourceId: c.id, targetId: a.id }});
  expect(cyc.status()).toBe(409);
  // First ensure deleting edge works while intact
  const del1 = await request.delete(`/api/edges/${a.id}/${edgeId}`);
  expect(del1.status()).toBe(204);
  // Recreate edge then remove node b to test integrity repair removing new dangling edge
  const addAB2 = await request.post('/api/edges', { data: { sourceId: a.id, targetId: b.id, kind: 'flow' }});
  expect(addAB2.status()).toBe(201);
  // Simulate dangling edge by raw-deleting node b via admin endpoint (no edge repair yet)
  const rawDel = await request.post('/api/admin/raw-delete-node', { data: { id: b.id }});
  expect(rawDel.status()).toBe(200);
  const list = await request.get('/api/nodes');
  const listJson = await list.json();
  expect(listJson.integrity.totalRemoved).toBeGreaterThan(0);
});
