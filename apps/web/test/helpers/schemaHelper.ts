import { promises as fs } from 'fs';
import { resolve } from 'path';
import { reloadSchemas } from '../../lib/schemaLoader';

export interface TempSchemaOptions {
  typeName?: string;
  requiredProps?: string[];
  extraProps?: Record<string, any>;
}

/**
 * Writes a minimal schema file into the current REPO_ROOT under schemas/nodes
 * and reloads the schema cache. Returns the full path to the schema file.
 */
export async function ensureTempSchema(opts: TempSchemaOptions = {}){
  const root = process.env.REPO_ROOT || process.cwd();
  const typeName = opts.typeName || 'Task';
  const schemaDir = resolve(root, 'schemas/nodes');
  await fs.mkdir(schemaDir, { recursive: true });
  const schema = {
    title: typeName,
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      name: { type: 'string' },
      props: { type: 'object', additionalProperties: true },
      position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x','y'] },
      edges: { type: 'object' }
    },
    required: ['id','type','name', ...(opts.requiredProps || [])],
    ...opts.extraProps
  };

  // Strict LLM schema override to mirror committed schema contract and avoid regressions
  if(typeName === 'LLM'){
    schema.properties.type = { const: 'LLM' } as any;
    schema.properties.props = {
      type: 'object',
      properties: {
        model: { type: 'string' },
        system: { type: 'string' },
        promptTemplate: { type: 'string' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        maxOutputTokens: { type: 'integer', minimum: 1, maximum: 8192, default: 1024 }
      },
      required: ['model'],
      additionalProperties: false
    } as any;
    if(!schema.required.includes('props')) schema.required.push('props');
  }
  const file = resolve(schemaDir, `${typeName}.schema.json`);
  await fs.writeFile(file, JSON.stringify(schema, null, 2));
  await reloadSchemas();
  return file;
}
