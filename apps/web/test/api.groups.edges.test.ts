import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import groupsHandler from '../pages/api/groups/index';
import createInGroupHandler from '../pages/api/groups/[id]/nodes';
import subgraphHandler from '../pages/api/groups/[id]/subgraph';
import groupEdgesHandler from '../pages/api/groups/[id]/edges/index';
import groupEdgeHandler from '../pages/api/groups/[id]/edges/[edgeId]';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';

async function invoke(handler: any, { method='GET', body, query }: any){
  const req: any = { method, body, query };
  const statusRef: any = { code: 200 };
  const res: any = { status(c: number){ statusRef.code = c; return this; }, json(obj: any){ (res as any).body = obj; return this; }, end(){ (res as any).ended = true; return this; } };
  await handler(req, res);
  return { status: statusRef.code, body: (res as any).body };
}

describe('Group edges API', () => {
  const tmpRoot = resolve(process.cwd(), '.api-test-groups-edges');
  beforeEach(async()=>{
    await fs.rm(tmpRoot, { recursive:true, force:true });
    await fs.mkdir(tmpRoot, { recursive:true });
    process.env.REPO_ROOT = tmpRoot;
  await seedBaseSchemasIfNeeded();
  });

  it('creates and lists an edge inside a group', async () => {
    const grp = await invoke(groupsHandler as any, { method:'POST', body:{ name:'G', inputs:['in'], outputs:['out'] } });
    const groupId = grp.body.group.id;
    const n1 = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'A' } });
    const n2 = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'B' } });
    const e = await invoke(groupEdgesHandler as any, { method:'POST', query:{ id: groupId }, body:{ sourceId: n1.body.node.id, targetId: n2.body.node.id } });
    expect(e.status).toBe(201);
    const sg = await invoke(subgraphHandler as any, { method:'GET', query:{ id: groupId } });
    expect(sg.status).toBe(200);
    expect(sg.body.edges.length).toBe(1);
    expect(sg.body.edges[0].sourceId).toBe(n1.body.node.id);
    expect(sg.body.edges[0].targetId).toBe(n2.body.node.id);
  });

  it('updates and deletes an edge', async () => {
    const grp = await invoke(groupsHandler as any, { method:'POST', body:{ name:'G2', inputs:['in'], outputs:['out'] } });
    expect(grp.status).toBe(201);
    expect(grp.body?.group?.id, 'group create body missing').toBeDefined();
    const groupId = grp.body.group.id;
    const n1 = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'A' } });
    const n2 = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'B' } });
    const e = await invoke(groupEdgesHandler as any, { method:'POST', query:{ id: groupId }, body:{ sourceId: n1.body.node.id, targetId: n2.body.node.id } });
    const edgeId = e.body.edge.id;
    const upd = await invoke(groupEdgeHandler as any, { method:'PUT', query:{ id: groupId, edgeId }, body:{ kind:'data' } });
    expect(upd.status).toBe(200);
    expect(upd.body.edge.kind).toBe('data');
    const del = await invoke(groupEdgeHandler as any, { method:'DELETE', query:{ id: groupId, edgeId } });
    expect(del.status).toBe(204);
    const sg = await invoke(subgraphHandler as any, { method:'GET', query:{ id: groupId } });
    expect(sg.body.edges.length).toBe(0);
  });

  it('rejects cycle in subgroup', async () => {
    const grp = await invoke(groupsHandler as any, { method:'POST', body:{ name:'G3', inputs:['in'], outputs:['out'] } });
    const groupId = grp.body.group.id;
    const a = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'A' } });
    const b = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'B' } });
    const c = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'C' } });
    await invoke(groupEdgesHandler as any, { method:'POST', query:{ id: groupId }, body:{ sourceId: a.body.node.id, targetId: b.body.node.id } });
    await invoke(groupEdgesHandler as any, { method:'POST', query:{ id: groupId }, body:{ sourceId: b.body.node.id, targetId: c.body.node.id } });
    const cyc = await invoke(groupEdgesHandler as any, { method:'POST', query:{ id: groupId }, body:{ sourceId: c.body.node.id, targetId: a.body.node.id } });
    expect(cyc.status).toBe(409);
  });
});
