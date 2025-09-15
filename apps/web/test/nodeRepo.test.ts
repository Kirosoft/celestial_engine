import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRepo, createNode, getNode, updateNode, renameNode, deleteNode, addEdge, removeEdge, updateEdge, listNodes } from '../lib/nodeRepo';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';
import { FileRepo } from '../lib/fileRepo';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { NotFoundError, CycleError } from '../lib/errors';

const tmpRoot = resolve(process.cwd(), '.test-nodes');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  // seed minimal schema to satisfy validator for generic type
  await seedBaseSchemasIfNeeded();
}

describe('NodeRepo CRUD & Edges', () => {
  beforeEach(reset);

  it('creates and retrieves node', async () => {
    const n = await createNode('Task', 't1', { foo: 1 });
    const loaded = await getNode(n.id);
    expect(loaded.id).toBe(n.id);
    expect(loaded.props.foo).toBe(1);
  });

  it('updates node props', async () => {
    const n = await createNode('Task');
    const updated = await updateNode(n.id, { props: { bar: 2 }});
    expect(updated.props.bar).toBe(2);
  });

  it('renames node and updates edges pointing to it', async () => {
    const a = await createNode('Task','A');
    const b = await createNode('Task','B');
    await addEdge(a.id, b.id, 'flow');
    await renameNode(b.id, 'B2');
    const refreshed = await getNode(a.id);
    expect(refreshed.edges?.out[0].targetId).toBe('B2');
  });

  it('deletes node and cleans inbound references', async () => {
    const a = await createNode('Task');
    const b = await createNode('Task');
    await addEdge(a.id, b.id);
    await deleteNode(b.id);
    const refreshed = await getNode(a.id);
    expect(refreshed.edges?.out.length).toBe(0);
  });

  it('throws on get missing', async () => {
    await expect(getNode('missing-id')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('prevents self-loop', async () => {
    const a = await createNode('Task');
    await expect(addEdge(a.id, a.id)).rejects.toBeInstanceOf(CycleError);
  });

  it('prevents cycle across three nodes', async () => {
    const a = await createNode('Task');
    const b = await createNode('Task');
    const c = await createNode('Task');
    await addEdge(a.id, b.id);
    await addEdge(b.id, c.id);
    await expect(addEdge(c.id, a.id)).rejects.toBeInstanceOf(CycleError);
  });

  it('updates edge', async () => {
    const a = await createNode('Task');
    const b = await createNode('Task');
    const e = await addEdge(a.id, b.id, 'flow');
    const updated = await updateEdge(a.id, e.id, { kind: 'data' });
    expect(updated.kind).toBe('data');
  });

  it('removes edge', async () => {
    const a = await createNode('Task');
    const b = await createNode('Task');
    const e = await addEdge(a.id, b.id, 'flow');
    await removeEdge(a.id, e.id);
    const refreshed = await getNode(a.id);
    expect(refreshed.edges?.out.length).toBe(0);
  });
});
