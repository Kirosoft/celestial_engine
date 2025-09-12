import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import nodesHandler from '../pages/api/nodes/index';
import edgesCreateHandler from '../pages/api/edges/index';
import edgeMutateHandler from '../pages/api/edges/[sourceId]/[edgeId]';
import { invoke } from './helpers/apiHelper';
import { ensureTempSchema } from './helpers/schemaHelper';

const tmpRoot = resolve(process.cwd(), '.api-test-edges');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await ensureTempSchema({ typeName: 'Task' });
}

describe('Edges API', () => {
  beforeEach(reset);

  async function makeTwo(){
    const a = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'A' }});
    const b = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'B' }});
    return { a: a.json!.node, b: b.json!.node };
  }

  it('adds edge', async () => {
    const { a, b } = await makeTwo();
    const add = await invoke(edgesCreateHandler as any, { method: 'POST', body: { sourceId: a.id, targetId: b.id, kind: 'flow' }});
    expect(add.status).toBe(201);
    expect(add.json?.edge.targetId).toBe(b.id);
  });

  it('updates edge kind', async () => {
    const { a, b } = await makeTwo();
    const add = await invoke(edgesCreateHandler as any, { method: 'POST', body: { sourceId: a.id, targetId: b.id }});
    const edgeId = add.json?.edge.id;
    const upd = await invoke(edgeMutateHandler as any, { method: 'PUT', query: { sourceId: a.id, edgeId }, body: { kind: 'data' }});
    expect(upd.status).toBe(200);
    expect(upd.json?.edge.kind).toBe('data');
  });

  it('deletes edge', async () => {
    const { a, b } = await makeTwo();
    const add = await invoke(edgesCreateHandler as any, { method: 'POST', body: { sourceId: a.id, targetId: b.id }});
    const edgeId = add.json?.edge.id;
    const del = await invoke(edgeMutateHandler as any, { method: 'DELETE', query: { sourceId: a.id, edgeId } });
    expect(del.status).toBe(204);
  });

  it('rejects cycle', async () => {
    const { a, b } = await makeTwo();
    await invoke(edgesCreateHandler as any, { method: 'POST', body: { sourceId: a.id, targetId: b.id }});
    const c = (await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'C' }})).json!.node;
    await invoke(edgesCreateHandler as any, { method: 'POST', body: { sourceId: b.id, targetId: c.id }});
    const cyc = await invoke(edgesCreateHandler as any, { method: 'POST', body: { sourceId: c.id, targetId: a.id }});
    expect(cyc.status).toBe(409);
  });
});
