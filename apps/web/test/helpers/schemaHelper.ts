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
        provider: { type: 'string', enum: ['openai','ollama'], default: 'openai' },
        system: { type: 'string' },
        autoDerivePromptFromFile: { type: 'boolean', default: true, description: 'If true, derive {prompt} from file when not explicitly provided.' },
        promptTemplate: { type: 'string' },
        useTemplate: { type: 'boolean', default: false, description: 'Use a prompt template from the template library' },
        templateId: { type: 'string', description: 'ID of the template to use (e.g., "summarization/article")' },
        templateVariables: { type: 'object', additionalProperties: true, description: 'Variables to pass to the template' },
        ollamaBaseUrl: { type: 'string', default: 'http://localhost:11434' },
        temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
        maxOutputTokens: { type: 'integer', minimum: 1, maximum: 32768, default: 4096 },
        outputCharLimit: { type: 'integer', minimum: 512, maximum: 524288, default: 32768 }
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
