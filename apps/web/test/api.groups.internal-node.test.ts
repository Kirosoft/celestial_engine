import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import { FileRepo } from '../lib/fileRepo';
import { ensureTempSchema } from './helpers/schemaHelper';
import groupsHandler from '../pages/api/groups/index';
import createInGroupHandler from '../pages/api/groups/[id]/nodes';
import subgraphHandler from '../pages/api/groups/[id]/subgraph';

async function invoke(handler: any, { method='GET', body, query }: any){
  const req: any = { method, body, query }; const statusRef: any = { code: 200 };
  const res: any = { status(c: number){ statusRef.code = c; return this; }, json(obj: any){ (res as any).body = obj; return this; } };
  await handler(req, res); return { status: statusRef.code, body: (res as any).body };
}

describe('Group internal node creation API', () => {
  const tmpRoot = resolve(process.cwd(), '.api-test-groups-internal');
  beforeEach(async()=>{
    await fs.rm(tmpRoot, { recursive:true, force:true });
    await fs.mkdir(tmpRoot, { recursive:true });
    process.env.REPO_ROOT = tmpRoot;
    // Seed minimal schemas for Group and Task so validation passes
    await ensureTempSchema({ typeName: 'Task' });
    await ensureTempSchema({ typeName: 'Group', extraProps: { properties: { ports: { type: 'object', properties: { inputs: { type:'array', items:{ type:'string' } }, outputs: { type:'array', items:{ type:'string' } } }, required:['inputs','outputs'] } }, required: ['id','type','name','ports'] } });
  });

  it('creates a node inside group subgraph and lists it', async () => {
    const createGroup = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'G1', inputs: ['inA'], outputs: ['outB'] } });
    expect(createGroup.status).toBe(201);
    const groupId = createGroup.body.group.id;
    const createNode = await invoke(createInGroupHandler as any, { method: 'POST', query: { id: groupId }, body: { type: 'Task', name: 'InnerTask', props: { max: 5 } } });
    expect(createNode.status).toBe(201);
    const subRes = await invoke(subgraphHandler as any, { method: 'GET', query: { id: groupId } });
    expect(subRes.status).toBe(200);
    const names = subRes.body.nodes.map((n: any)=>n.name).sort();
    expect(names).toContain('InnerTask');
    expect(names).toContain('inA');
    expect(names).toContain('outB');
  });
});
