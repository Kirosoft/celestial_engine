import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import nodesIndexHandler from '../pages/api/nodes/index';
import nodeGetHandler from '../pages/api/nodes/[id]';
import nodeTypesHandler from '../pages/api/node-types';
import { invoke } from './helpers/apiHelper';
import { buildDefaultProps } from '../lib/defaultProps';

const tmpRoot = resolve(process.cwd(), '.chatnode-test-root');

async function writeChatSchema(){
  const dest = resolve(tmpRoot, 'schemas/nodes');
  await fs.mkdir(dest, { recursive: true });
  const schema = {
    $id: 'nodes/ChatNode.schema.json',
    title: 'ChatNode',
    type: 'object',
    properties: {
      id: { type:'string' },
      type: { const: 'ChatNode' },
      name: { type:'string' },
      position: { type:'object', properties:{ x:{ type:'number' }, y:{ type:'number' } }, required:['x','y'] },
      props: { type:'object', properties:{ history: { type:'array', items:{ type:'object', properties:{ id:{ type:'string' }, role:{ type:'string' }, content:{ type:'string' }, ts:{ type:'number' } }, required:['id','role','content','ts'] } } }, required:['history'] }
    },
    required: ['id','type','name','props']
  };
  await fs.writeFile(resolve(dest, 'ChatNode.schema.json'), JSON.stringify(schema, null, 2));
}

describe('ChatNode basic creation', () => {
  beforeAll(async () => {
    process.env.REPO_ROOT = tmpRoot;
    await fs.rm(tmpRoot, { recursive: true, force: true });
    await fs.mkdir(tmpRoot, { recursive: true });
    await writeChatSchema();
  });

  it('creates ChatNode with empty history array', async () => {
    const typesResp = await invoke(nodeTypesHandler as any, { method: 'GET' });
    expect(typesResp.status).toBe(200);
    const meta = typesResp.json?.nodeTypes.find((t:any)=> t.id === 'ChatNode');
    expect(meta).toBeTruthy();
    const props = buildDefaultProps('ChatNode', meta.requiredPropKeys || []);
    expect(Array.isArray(props.history)).toBe(true);
    expect(props.history.length).toBe(0);
    const create = await invoke(nodesIndexHandler as any, { method:'POST', body:{ type:'ChatNode', name:'ChatNode', props } });
    expect(create.status).toBe(201);
    const id = create.json?.node?.id;
    const get = await invoke(nodeGetHandler as any, { method:'GET', query:{ id } });
    expect(get.status).toBe(200);
    expect(Array.isArray(get.json?.node?.props?.history)).toBe(true);
    expect(get.json?.node?.props?.history.length).toBe(0);
  });
});
