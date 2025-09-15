import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import groupsHandler from '../pages/api/groups/index';
import createInGroupHandler from '../pages/api/groups/[id]/nodes';
import subgraphHandler from '../pages/api/groups/[id]/subgraph';
import internalNodeHandler from '../pages/api/groups/[id]/nodes/[nodeId]';
import { ensureTempSchema } from './helpers/schemaHelper';

async function invoke(handler: any, { method='GET', body, query }: any){
  const req: any = { method, body, query };
  const statusRef: any = { code: 200 };
  const res: any = { status(c: number){ statusRef.code = c; return this; }, json(obj: any){ (res as any).body = obj; return this; }, end(){ (res as any).ended = true; return this; } };
  await handler(req, res);
  return { status: statusRef.code, body: (res as any).body };
}

describe('Group internal deletion', () => {
  const tmpRoot = resolve(process.cwd(), '.api-test-groups');
  beforeEach(async()=>{
    await fs.rm(tmpRoot, { recursive:true, force:true });
    await fs.mkdir(tmpRoot, { recursive:true });
    process.env.REPO_ROOT = tmpRoot;
    await ensureTempSchema({ typeName: 'Task' });
    await ensureTempSchema({ typeName: 'Group', extraProps: { properties: { ports: { type: 'object', properties: { inputs: { type:'array', items:{ type:'string' } }, outputs: { type:'array', items:{ type:'string' } } }, required:['inputs','outputs'] } }, required: ['id','type','name','ports'] } });
  });

  it('deletes a non-proxy node inside a group', async () => {
    const groupRes = await invoke(groupsHandler as any, { method:'POST', body: { name: 'G', inputs:['in1'], outputs:['out1'] } });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.group.id;
    const inner = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body: { type:'Task', name:'InnerTask' } });
    expect(inner.status).toBe(201);
    const nodeId = inner.body.node.id;
    const del = await invoke(internalNodeHandler as any, { method:'DELETE', query:{ id: groupId, nodeId } });
    expect(del.status).toBe(204);
    const sub = await invoke(subgraphHandler as any, { method:'GET', query:{ id: groupId } });
    const ids = sub.body.nodes.map((n:any)=>n.id);
    expect(ids).not.toContain(nodeId);
  });

  it('forbids deleting proxy nodes', async () => {
    const groupRes = await invoke(groupsHandler as any, { method:'POST', body: { name: 'G2', inputs:['inA'], outputs:['outB'] } });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.group.id;
    const sub = await invoke(subgraphHandler as any, { method:'GET', query:{ id: groupId } });
    const proxy = sub.body.nodes.find((n:any)=> n.type === 'GroupInputProxy');
    expect(proxy).toBeTruthy();
    const attempt = await invoke(internalNodeHandler as any, { method:'DELETE', query:{ id: groupId, nodeId: proxy.id } });
    expect(attempt.status).toBe(400);
    expect(attempt.body.error.code).toBe('cannot_delete_proxy');
  });

  it('recursively deletes nested subgroup subgraph', async () => {
    const groupRes = await invoke(groupsHandler as any, { method:'POST', body: { name: 'Parent', inputs:['in'], outputs:['out'] } });
    const parentId = groupRes.body.group.id;
    const nested = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: parentId }, body: { type:'Group', name:'Child', inputs:['a'], outputs:['b'] } });
    expect(nested.status).toBe(201);
    const childId = nested.body.node.id;
    // Ensure subgraph seeded
    const subChildDir = resolve(tmpRoot, 'groups', childId);
    const statBefore = await fs.stat(subChildDir);
    expect(statBefore.isDirectory()).toBe(true);
    const del = await invoke(internalNodeHandler as any, { method:'DELETE', query:{ id: parentId, nodeId: childId } });
    expect(del.status).toBe(204);
    let removed = false;
    try { await fs.stat(subChildDir); } catch { removed = true; }
    expect(removed).toBe(true);
  });
});
