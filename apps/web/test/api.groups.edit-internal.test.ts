import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import groupsHandler from '../pages/api/groups/index';
import createInGroupHandler from '../pages/api/groups/[id]/nodes';
import internalNodeHandler from '../pages/api/groups/[id]/nodes/[nodeId]';
import { ensureTempSchema } from './helpers/schemaHelper';

async function invoke(handler: any, { method='GET', body, query }: any){
  const req: any = { method, body, query };
  const statusRef: any = { code: 200 };
  const res: any = { status(c: number){ statusRef.code = c; return this; }, json(obj: any){ (res as any).body = obj; return this; }, end(){ (res as any).ended = true; return this; } };
  await handler(req, res);
  return { status: statusRef.code, body: (res as any).body };
}

describe('Group internal node editing', () => {
  const tmpRoot = resolve(process.cwd(), '.api-test-groups-subgraph');
  beforeEach(async()=>{
    await fs.rm(tmpRoot, { recursive:true, force:true });
    await fs.mkdir(tmpRoot, { recursive:true });
    process.env.REPO_ROOT = tmpRoot;
    await ensureTempSchema({ typeName: 'Task' });
    await ensureTempSchema({ typeName: 'Group', extraProps: { properties: { ports: { type: 'object', properties: { inputs: { type:'array', items:{ type:'string' } }, outputs: { type:'array', items:{ type:'string' } } }, required:['inputs','outputs'] } }, required: ['id','type','name','ports'] } });
  });

  it('edits a task node inside a group', async () => {
    const group = await invoke(groupsHandler as any, { method:'POST', body: { name: 'G', inputs:['a'], outputs:['b'] } });
    const groupId = group.body.group.id;
    const task = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: groupId }, body:{ type:'Task', name:'Inner', props:{ value:1 } } });
    const taskId = task.body.node.id;
    const edit = await invoke(internalNodeHandler as any, { method:'PUT', query:{ id: groupId, nodeId: taskId }, body:{ name:'InnerEdited', props:{ value:2 } } });
    expect(edit.status).toBe(200);
    expect(edit.body.node.name).toBe('InnerEdited');
    expect(edit.body.node.props.value).toBe(2);
  });

  it('prevents editing proxy node', async () => {
    const group = await invoke(groupsHandler as any, { method:'POST', body: { name: 'G2', inputs:['p'], outputs:['q'] } });
    const groupId = group.body.group.id;
    // list proxies by reading one directly via GET
    const proxyId = '__input_p';
    const attempt = await invoke(internalNodeHandler as any, { method:'PUT', query:{ id: groupId, nodeId: proxyId }, body:{ name:'ShouldFail' } });
    expect(attempt.status).toBe(400);
    expect(attempt.body.error.code).toBe('cannot_edit_proxy');
  });

  it('preserves ports & subgraphRef when editing nested group node', async () => {
    const parent = await invoke(groupsHandler as any, { method:'POST', body:{ name:'Parent', inputs:['in'], outputs:['out'] } });
    const parentId = parent.body.group.id;
    const child = await invoke(createInGroupHandler as any, { method:'POST', query:{ id: parentId }, body:{ type:'Group', name:'Child', inputs:['x'], outputs:['y'] } });
    const childId = child.body.node.id;
    const originalRef = child.body.node.subgraphRef;
    const edit = await invoke(internalNodeHandler as any, { method:'PUT', query:{ id: parentId, nodeId: childId }, body:{ name:'ChildRenamed', subgraphRef:'MUTATED', ports:{ inputs:[], outputs:[] } } });
    expect(edit.status).toBe(200);
    expect(edit.body.node.name).toBe('ChildRenamed');
    expect(edit.body.node.subgraphRef).toBe(originalRef);
    expect(edit.body.node.ports.inputs.length).toBe(1);
    expect(edit.body.node.ports.outputs.length).toBe(1);
  });
});
