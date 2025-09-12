import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import nodesHandler from '../pages/api/nodes/index';
import nodeDetailHandler from '../pages/api/nodes/[id]';
import renameHandler from '../pages/api/nodes/[id]/rename';
import positionHandler from '../pages/api/nodes/[id]/position';
import { invoke } from './helpers/apiHelper';
import { ensureTempSchema } from './helpers/schemaHelper';

const tmpRoot = resolve(process.cwd(), '.api-test-nodes');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await ensureTempSchema({ typeName: 'Task' });
}

describe('Nodes API', () => {
  beforeEach(reset);

  it('creates and lists nodes', async () => {
    const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'First' }});
    expect(create.status).toBe(201);
    const list = await invoke(nodesHandler as any, { method: 'GET' });
    expect(list.status).toBe(200);
    expect(list.json?.nodes.length).toBe(1);
  });

  it('retrieves node by id', async () => {
    const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'GetMe' }});
    const id = create.json?.node.id;
    const get = await invoke(nodeDetailHandler as any, { method: 'GET', query: { id } });
    expect(get.status).toBe(200);
    expect(get.json?.node.name).toBe('GetMe');
  });

  it('updates node props', async () => {
    const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'PatchMe' }});
    const id = create.json?.node.id;
    const put = await invoke(nodeDetailHandler as any, { method: 'PUT', query: { id }, body: { props: { v: 9 } }});
    expect(put.status).toBe(200);
    expect(put.json?.node.props.v).toBe(9);
  });

  it('renames node', async () => {
    const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'Old' }});
    const id = create.json?.node.id;
    const rename = await invoke(renameHandler as any, { method: 'POST', query: { id }, body: { newId: id + '_new' }});
    expect(rename.status).toBe(200);
    expect(rename.json?.node.id).toBe(id + '_new');
  });

  it('updates position', async () => {
    const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'Pos' }});
    const id = create.json?.node.id;
    const pos = await invoke(positionHandler as any, { method: 'POST', query: { id }, body: { x: 400, y: 500 }});
    expect(pos.status).toBe(200);
    expect(pos.json?.node.position.x).toBe(400);
  });

  it('deletes node', async () => {
    const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: 'Task', name: 'Temp' }});
    const id = create.json?.node.id;
    const del = await invoke(nodeDetailHandler as any, { method: 'DELETE', query: { id } });
    expect(del.status).toBe(204);
    const get = await invoke(nodeDetailHandler as any, { method: 'GET', query: { id } });
    expect(get.status).toBe(404);
  });
});
