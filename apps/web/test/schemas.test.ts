import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { validateNode } from '../lib/validator';
import { reloadSchemas } from '../lib/schemaLoader';

// Use actual repo root for consolidated schemas
const repoRoot = resolve(process.cwd(), '..', '..');

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
    process.env.REPO_ROOT = repoRoot;
    await reloadSchemas();
  });

  for(const t of types){
    it(`validates base ${t} node`, async () => {
      const result = await validateNode(sampleNode(t));
      expect(result.valid).toBe(true);
    });
  }
});
