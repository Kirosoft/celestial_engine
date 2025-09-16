import { describe, it, expect, beforeEach } from 'vitest';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';
import { createNode, addEdge, getNode } from '../lib/nodeRepo';
import { emitFrom, getInputBuffers } from '../lib/execution';
import { promises as fs } from 'fs';
import { resolve } from 'path';

const tmpRoot = resolve(process.cwd(), '.test-chat-pipeline');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await seedBaseSchemasIfNeeded();
}

describe('Chat -> LLM -> Log pipeline smoke', () => {
  beforeEach(reset);

  it('propagates a user message to LLM and logs assistant output', async () => {
    const chat = await createNode('ChatNode');
    const llm = await createNode('LLM', undefined, { promptTemplate: '{message}' });
    const log = await createNode('LogNode');
    await addEdge(chat.id, llm.id, 'flow');
    await addEdge(llm.id, log.id, 'flow');

    // Emit a user message from ChatNode
    await emitFrom(chat.id, 'message', 'Hello');

    // LLM should have received input buffer for 'message'
    const buffers = getInputBuffers();
    expect(buffers[llm.id]?.message?.length).toBeGreaterThan(0);

    // LogNode should now have assistant output in its props.history
    const updatedLog = await getNode(log.id) as any;
    const hist = updatedLog.props?.history || [];
    // Expect exactly one Assistant echo entry
  const assistantEntry = hist.find((h: any) => typeof h.preview === 'string' && h.preview.includes('Assistant: Hello'));
    expect(assistantEntry, 'Assistant echo should be logged').toBeTruthy();
  });
});
