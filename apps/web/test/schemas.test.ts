import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { validateNode } from '../lib/validator';
import { reloadSchemas } from '../lib/schemaLoader';

const tmpRoot = resolve(process.cwd(), '.schema-test-all');

const types = [ 'ToolCall','Router','Merge','Code','GitHubInput','GitHubOutput','Eval' ];

function sampleNode(type: string){
  const base: any = { id: type+'-1', type, name: type+'-1', props: {} };
  switch(type){
    case 'ToolCall': base.props.toolName = 'echo'; break;
    case 'Router': base.props.strategy = 'first'; break;
    case 'Merge': base.props.mode = 'concat'; break;
    case 'Code': base.props.language = 'ts'; base.props.source = 'return 1'; break;
    case 'GitHubInput': base.props.repo = 'org/repo'; break;
    case 'GitHubOutput': base.props.repo = 'org/repo'; base.props.commitMessage = 'test'; break;
    case 'Eval': base.props.metric = 'accuracy'; break;
  }
  return base;
}

describe('Seed Schemas', () => {
  beforeAll(async () => {
    process.env.REPO_ROOT = tmpRoot;
    await fs.rm(tmpRoot, { recursive: true, force: true });
    await fs.mkdir(tmpRoot, { recursive: true });
    // Copy existing schema directory contents into tmp root
    const schemaSrc = resolve(process.cwd(), 'schemas/nodes');
    const schemaDest = resolve(tmpRoot, 'schemas/nodes');
    await fs.mkdir(schemaDest, { recursive: true });
    for(const f of await fs.readdir(schemaSrc)){
      if(f.endsWith('.schema.json')){
        await fs.copyFile(resolve(schemaSrc, f), resolve(schemaDest, f));
      }
    }
    await reloadSchemas();
  });

  for(const t of types){
    it(`validates base ${t} node`, async () => {
      const result = await validateNode(sampleNode(t));
      expect(result.valid).toBe(true);
    });
  }
});
