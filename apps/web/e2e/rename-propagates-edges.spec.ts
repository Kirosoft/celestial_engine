import { test, expect } from '@playwright/test';
import { resetRepoRoot } from './helpers';

/* Scenario: Rename target node with inbound edges
   Steps:
   1. Create three Task nodes A, B, C.
   2. Create edges A -> B, C -> B.
   3. Rename B to B2 via API.
   4. Fetch nodes A and C; ensure their outgoing edges now target B2 (no lingering B).
   5. Verify original file for B is gone, new file exists, and index updated (no entry for old id).
*/

test.beforeEach(async () => { await resetRepoRoot(); });

test('renaming a node propagates inbound edge targetIds', async ({ request }) => {
  // Create nodes (provide required props.title)
  const mk = async (name: string) => (await (await request.post('/api/nodes', { data: { type: 'Task', name, props: { title: name+' t' } }})).json()).node;
  const a = await mk('A');
  const b = await mk('B');
  const c = await mk('C');
  // Create edges pointing to B
  const addEdge = async (source: any, target: any) => request.post('/api/edges', { data: { sourceId: source.id, targetId: target.id, kind: 'flow' }});
  expect((await addEdge(a,b)).status()).toBe(201);
  expect((await addEdge(c,b)).status()).toBe(201);
  // Rename B to B2
  const renameRes = await request.post(`/api/nodes/${b.id}/rename`, { data: { newId: b.id + '_2' }});
  expect(renameRes.status()).toBe(200);
  const renamed = (await renameRes.json()).node;
  expect(renamed.id).toBe(b.id + '_2');
  // Re-fetch A and C
  const fetchNode = async (id: string) => (await (await request.get(`/api/nodes/${id}`)).json()).node;
  const aRef = await fetchNode(a.id);
  const cRef = await fetchNode(c.id);
  const aTargets = aRef.edges.out.map((e: any)=>e.targetId);
  const cTargets = cRef.edges.out.map((e: any)=>e.targetId);
  expect(aTargets).toContain(renamed.id);
  expect(cTargets).toContain(renamed.id);
  expect(aTargets).not.toContain(b.id);
  expect(cTargets).not.toContain(b.id);
  // Index should only contain new id (list nodes)
  const list = await request.get('/api/nodes');
  const listJson = await list.json();
  const ids = listJson.nodes.map((n: any)=>n.id);
  expect(ids).toContain(renamed.id);
  expect(ids).not.toContain(b.id);
});
