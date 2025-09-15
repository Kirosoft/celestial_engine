import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import groupsHandler from '../pages/api/groups/index';
import nodesHandler from '../pages/api/nodes/index';
import { invoke } from './helpers/apiHelper';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';

const tmpRoot = resolve(process.cwd(), '.api-test-groups');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  // Provide schemas for Group and a simple Task for potential future internal nodes
  await seedBaseSchemasIfNeeded();
}

describe('Groups API', () => {
  beforeEach(reset);

  it('creates a group with proxies', async () => {
    const r = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'G1', inputs: ['inA'], outputs: ['outB'] } });
    expect(r.status).toBe(201);
    const group = r.json?.group;
    expect(group?.ports?.inputs).toContain('inA');
    expect(group?.ports?.outputs).toContain('outB');
    expect(group?.subgraphRef).toBe(`groups/${group.id}`);
  });

  it('rejects overlapping port names', async () => {
    const r = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'G1', inputs: ['x'], outputs: ['x'] } });
    expect(r.status).toBe(400);
    expect(r.json?.error?.code).toBe('ports_not_disjoint');
  });
});
