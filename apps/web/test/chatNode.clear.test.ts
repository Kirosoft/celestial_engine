import { describe, it, expect, beforeAll } from 'vitest';
import { createNode, updateNode, getNode } from '../lib/nodeRepo';
import { reloadSchemas } from '../lib/schemaLoader';
import { resolve } from 'path';

// Simple integration test for clear action semantics (simulated by direct update)

describe('ChatNode clear history', () => {
  let chatId: string;
  beforeAll(async () => {
    process.env.REPO_ROOT = resolve(__dirname, '../../..');
    await reloadSchemas();
    const n = await createNode('ChatNode', 'Chat-Clear', { history: [] });
    chatId = n.id;
  });
  it('persists cleared history', async () => {
    // Seed history
    const node: any = await getNode(chatId);
    node.props.history = [ { id:'a', role:'user', content:'Hello', ts:Date.now() }, { id:'b', role:'assistant', content:'Hi', ts:Date.now() } ];
    await updateNode(chatId, { props: node.props });
    let updated: any = await getNode(chatId);
    expect(updated.props.history.length).toBe(2);
    // Clear
    await updateNode(chatId, { props: { ...updated.props, history: [] } });
    updated = await getNode(chatId);
    expect(updated.props.history.length).toBe(0);
  });
});
