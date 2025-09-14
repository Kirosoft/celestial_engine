import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import nodesHandler from '../pages/api/nodes/index';
import nodeTypesHandler from '../pages/api/node-types';
import { invoke } from './helpers/apiHelper';
import { buildDefaultProps } from '../lib/defaultProps';

const tmpRoot = resolve(process.cwd(), '.defaults-test-root');

async function setupSchemas(){
  // Write minimal copies of the Task, Plan, LLM schemas required for default prop regression
  const dest = resolve(tmpRoot, 'schemas/nodes');
  await fs.mkdir(dest, { recursive: true });
  const schemas: Record<string, any> = {
    Task: {
      $id: 'nodes/Task.schema.json',
      title: 'Task',
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { const: 'Task' },
        name: { type: 'string' },
        position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x','y'] },
        props: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] }
      },
      required: ['id','type','name','props'],
      additionalProperties: true
    },
    Plan: {
      $id: 'nodes/Plan.schema.json',
      title: 'Plan',
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { const: 'Plan' },
        name: { type: 'string' },
        position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x','y'] },
        props: { type: 'object', properties: { plannerModel: { type: 'string' } }, required: ['plannerModel'] }
      },
      required: ['id','type','name','props'],
      additionalProperties: true
    },
    LLM: {
      $id: 'nodes/LLM.schema.json',
      title: 'LLM',
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { const: 'LLM' },
        name: { type: 'string' },
        position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x','y'] },
        props: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'] }
      },
      required: ['id','type','name','props'],
      additionalProperties: true
    }
  };
  for(const [name, schema] of Object.entries(schemas)){
    await fs.writeFile(resolve(dest, `${name}.schema.json`), JSON.stringify(schema, null, 2));
  }
}

describe('Default prop creation regression', () => {
  beforeAll(async () => {
    process.env.REPO_ROOT = tmpRoot;
    await fs.rm(tmpRoot, { recursive: true, force: true });
    await fs.mkdir(tmpRoot, { recursive: true });
    await setupSchemas();
  });

  const typesToTest = ['Task','Plan','LLM'];

  for(const typeName of typesToTest){
    it(`creates ${typeName} node with inferred required props`, async () => {
      // fetch node types metadata
      const typesResp = await invoke(nodeTypesHandler as any, { method: 'GET' });
      expect(typesResp.status).toBe(200);
      const meta = typesResp.json?.nodeTypes.find((t: any)=> t.id === typeName);
      expect(meta, 'schema meta not found').toBeTruthy();
      const props = buildDefaultProps(typeName, meta.requiredPropKeys || []);
      const create = await invoke(nodesHandler as any, { method: 'POST', body: { type: typeName, name: typeName, props } });
      if(create.status !== 201){
        console.error('Create error body', create.json);
      }
      expect(create.status).toBe(201);
      const node = create.json?.node;
      expect(node?.type).toBe(typeName);
      for(const k of meta.requiredPropKeys){
        expect(node?.props?.[k]).not.toBeUndefined();
      }
    });
  }
});
