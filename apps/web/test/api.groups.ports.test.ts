import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import groupsHandler from '../pages/api/groups/index';
import portsHandler from '../pages/api/groups/[id]/ports';
import subgraphHandler from '../pages/api/groups/[id]/subgraph';
import { invoke } from './helpers/apiHelper';
import { ensureTempSchema } from './helpers/schemaHelper';

const tmpRoot = resolve(process.cwd(), '.api-test-groups-ports');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  // Retry deletion up to 3 times if ENOTEMPTY (async file writes finishing)
  for(let attempt=0; attempt<3; attempt++){
    try { await fs.rm(tmpRoot, { recursive: true, force: true }); break; }
    catch(e:any){ if(e?.code !== 'ENOTEMPTY' || attempt===2) throw e; await new Promise(r=>setTimeout(r,50)); }
  }
  await fs.mkdir(tmpRoot, { recursive: true });
  await ensureTempSchema({ typeName: 'Task' });
  await ensureTempSchema({ typeName: 'Group', extraProps: { properties: { ports: { type: 'object', properties: { inputs: { type: 'array', items: { type: 'string' } }, outputs: { type: 'array', items: { type: 'string' } } }, required: ['inputs','outputs'] } }, required: ['id','type','name','ports'] } });
}

describe('Group Ports API', () => {
  beforeEach(reset);

  it('adds and removes ports with proxy sync', async () => {
    const create = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'GP', inputs: ['inA'], outputs: ['outA'] } });
    const groupId = create.json?.group.id;
    const patch = await invoke(portsHandler as any, { method: 'PATCH', query: { id: groupId }, body: { inputs: ['inA','inB'], outputs: ['outB'] } });
    expect(patch.status).toBe(200);
    expect(patch.json?.group.ports.inputs).toEqual(['inA','inB']);
    expect(patch.json?.group.ports.outputs).toEqual(['outB']);
    expect(patch.json?.changes.addedInputs).toEqual(['inB']);
    expect(patch.json?.changes.removedOutputs).toEqual(['outA']);
    // Subgraph should now have proxies for inA,inB,outB only
    const sub = await invoke(subgraphHandler as any, { method: 'GET', query: { id: groupId } });
    const ids = (sub.json?.nodes||[]).map((n:any)=>n.id).sort();
    expect(ids).toContain('__input_inA');
    expect(ids).toContain('__input_inB');
    expect(ids).not.toContain('__output_outA');
    expect(ids).toContain('__output_outB');
  });

  it('rejects overlap', async () => {
    const create = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'GP2', inputs: ['a'], outputs: ['b'] } });
    const groupId = create.json?.group.id;
    const patch = await invoke(portsHandler as any, { method: 'PATCH', query: { id: groupId }, body: { inputs: ['a','x'], outputs: ['x'] } });
    expect(patch.status).toBe(400);
    expect(patch.json?.error?.code).toBe('ports_not_disjoint');
  });

  it('rejects invalid names', async () => {
    const create = await invoke(groupsHandler as any, { method: 'POST', body: { name: 'GP3', inputs: [], outputs: [] } });
    expect(create.status).toBe(201);
    expect(create.json?.group?.id).toBeDefined();
    const groupId = create.json!.group.id;
    const patch = await invoke(portsHandler as any, { method: 'PATCH', query: { id: groupId }, body: { inputs: ['1bad'], outputs: [] } });
    expect(patch.status).toBe(400);
    expect(patch.json?.error?.code).toBe('invalid_port_name');
  });
});
