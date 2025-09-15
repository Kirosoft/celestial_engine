import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import groupsHandler from '../pages/api/groups/index';
import subgraphHandler from '../pages/api/groups/[id]/subgraph';
import { invoke } from './helpers/apiHelper';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';

const tmpRoot = resolve(process.cwd(), '.api-test-groups-subgraph');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await seedBaseSchemasIfNeeded();
}

describe('Group Subgraph API', () => {
  beforeEach(reset);

  it('returns proxy nodes for a new group', async () => {
    const create = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'GSub', inputs: ['inA','inB'], outputs: ['outX'] } });
    expect(create.status).toBe(201);
    const groupId = create.json?.group.id;
    const sub = await invoke(subgraphHandler as any, { method: 'GET', query: { id: groupId } });
    expect(sub.status).toBe(200);
    const nodes = sub.json?.nodes || [];
    const ids = nodes.map((n: any)=> n.id).sort();
    expect(ids).toContain('__input_inA');
    expect(ids).toContain('__input_inB');
    expect(ids).toContain('__output_outX');
    expect(sub.json?.edges).toEqual([]);
  });

  it('404s for unknown group id', async () => {
    const sub = await invoke(subgraphHandler as any, { method: 'GET', query: { id: 'Group-DoesNotExist' } });
    expect(sub.status).toBe(404);
    expect(sub.json?.error?.code).toBe('group_not_found');
  });
});
