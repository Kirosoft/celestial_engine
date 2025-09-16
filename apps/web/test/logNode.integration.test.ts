import { describe, it, expect, beforeAll } from 'vitest';
import { createNode, addEdge, getNode } from '../lib/nodeRepo';
import { emitFrom } from '../lib/execution';
import { reloadSchemas } from '../lib/schemaLoader';
import { resolve } from 'path';

// Basic integration test verifying LogNode captures emissions and cannot be source

describe('LogNode integration', () => {
  let logId: string; let chatId: string;
  beforeAll(async () => {
    const repoRoot = resolve(__dirname, '../../..');
    process.env.REPO_ROOT = repoRoot;
    await reloadSchemas();
    const log = await createNode('LogNode', 'Log-Demo', { history: [], maxEntries: 5 });
    const chat = await createNode('ChatNode', 'Chat-Demo', { history: [] });
    logId = log.id; chatId = chat.id;
    await addEdge(chatId, logId, 'flow');
  });

  it('captures emissions from upstream node', async () => {
    // Simulate an emission (bypass running executors) by calling emitFrom
    await emitFrom(chatId, 'message', 'Hello Log');
    const logNode = await getNode(logId) as any;
    expect(logNode.props.history.length).toBe(1);
    expect(logNode.props.history[0].preview).toContain('Hello');
  });

  it('trims history to maxEntries', async () => {
    for(let i=0;i<10;i++){
      await emitFrom(chatId, 'message', 'M'+i);
    }
    const logNode = await getNode(logId) as any;
    expect(logNode.props.history.length).toBe(5);
    expect(logNode.props.history[0].preview).toBe('M5');
  });

  it('rejects outbound edge creation from LogNode', async () => {
    let err: any; let blocked = false;
    try { await addEdge(logId, chatId, 'flow'); } catch(e:any){ err = e; blocked = true; }
    expect(blocked).toBe(true);
    expect(String(err.message || err)).toMatch(/LogNode/);
  });
});
