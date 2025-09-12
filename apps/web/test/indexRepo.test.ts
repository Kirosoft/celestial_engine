import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { addOrUpdateNodeIndex, listIndexNodes, removeNodeFromIndex, rebuildIndex } from '../lib/indexRepo';
import type { NodeFile } from '../lib/nodeRepo';

const tmpRoot = resolve(process.cwd(), '.test-index');

async function baseNode(id: string): Promise<NodeFile>{
  return { id, type: 'Task', name: id, props: { v: Math.random() }, position: { x:0, y:0 }, edges: { out: [] } } as any;
}

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.mkdir(resolve(tmpRoot, '.awb'), { recursive: true });
}

describe('IndexRepo', () => {
  beforeEach(reset);

  it('adds and lists nodes', async () => {
    const n1 = await baseNode('n1');
    await addOrUpdateNodeIndex(n1);
    const nodes = await listIndexNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('n1');
  });

  it('updates hash when props change', async () => {
    const n1 = await baseNode('n1');
    await addOrUpdateNodeIndex(n1);
    const first = (await listIndexNodes())[0].propsHash;
    n1.props.v = 1234;
    await addOrUpdateNodeIndex(n1);
    const second = (await listIndexNodes())[0].propsHash;
    expect(second).not.toBe(first);
  });

  it('removes node', async () => {
    const n1 = await baseNode('n1');
    await addOrUpdateNodeIndex(n1);
    await removeNodeFromIndex('n1');
    const nodes = await listIndexNodes();
    expect(nodes.length).toBe(0);
  });

  it('rebuilds index from nodes', async () => {
    const n1 = await baseNode('n1');
    const n2 = await baseNode('n2');
    await rebuildIndex([n1,n2]);
    const nodes = await listIndexNodes();
    expect(nodes.length).toBe(2);
  });
});
