import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';
import { createNode, updateNode, getNode } from '../lib/nodeRepo';

const tmpRoot = resolve(process.cwd(), '.test-llm-save');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await seedBaseSchemasIfNeeded();
}

describe('LLM node save validation', () => {
  beforeEach(reset);

  it('creates and updates LLM node with extended props', async () => {
    const created = await createNode('LLM', 'llm1', { model: 'gpt-test', provider: 'openai', temperature: 0.5, maxOutputTokens: 2048, outputCharLimit: 5000, autoDerivePromptFromFile: true });
    expect(created.props.model).toBe('gpt-test');
    expect(created.props.maxOutputTokens).toBe(2048);
    const updated = await updateNode(created.id, { props: { ...created.props, promptTemplate: '{prompt}', autoDerivePromptFromFile: false } });
    expect(updated.props.promptTemplate).toBe('{prompt}');
    expect(updated.props.autoDerivePromptFromFile).toBe(false);
    // ensure required model still present
    expect(updated.props.model).toBe('gpt-test');
    const reloaded = await getNode(created.id);
    expect(reloaded.props.provider).toBe('openai');
  });
});
