import { runNode, appendInput } from '../lib/execution';
import { createNode } from '../lib/nodeRepo';
import { ensureTempSchema } from './helpers/schemaHelper';
import { reloadSchemas } from '../lib/schemaLoader';
import { resolve } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';

describe('execution.run', () => {
  beforeAll(async ()=>{
    // Use real repo root so we pick up production schemas, then overlay LLM temp if needed
    const repoRoot = resolve(__dirname, '../../..');
    process.env.REPO_ROOT = repoRoot;
    await reloadSchemas();
    await ensureTempSchema({ typeName: 'LLM' });
  });
  it('runs LLM executor stub and produces output', async () => {
    const node = await createNode('LLM', 'LLM-Demo', { model: 'stub', promptTemplate: 'Echo: {message}' });
    appendInput(node.id, 'message', 'Hello', { edgeId: 'e_test', sourceNodeId: 'ChatNode-Seed' });
    const result: any = await runNode(node.id, {});
    expect(result.error).toBeUndefined();
    const emission = result.emissions?.find((e: any)=> e.port === 'output');
    expect(emission).toBeTruthy();
    expect(emission.value).toContain('Hello');
  });
});
