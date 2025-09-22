import { describe, it, expect, vi } from 'vitest';
import { buildVarMappings } from '../varMapping';

// We will stub listNodes & readFileSafe via vi.mock if needed; for now create lightweight mocks by temporarily monkey patching.
import * as nodeRepo from '../../nodeRepo';
import * as fileScanner from '../../fileScanner';

describe('buildVarMappings', () => {
  it('adds implicit var for file reader with autoDerive', async () => {
    const nodeId = 'LLM-1';
    const fileNode = { id: 'FileReaderNode-1', type: 'FileReaderNode', props: { filePath: 'docs/sample.txt', emitContent: true }, edges: { out: [ { id: 'e1', targetId: nodeId, kind: 'data', sourcePort: 'file' } ] } } as any;
    const llmNode = { id: nodeId, type: 'LLM', props: {}, edges: { out: [] } } as any;
    const nodes = [fileNode, llmNode];
    const listSpy = vi.spyOn(nodeRepo, 'listNodes').mockResolvedValue(nodes as any);
    vi.spyOn(fileScanner, 'readFileSafe').mockResolvedValue({ ok: true, content: Buffer.from('Hello File Content'), stat: { size: 19 } } as any);
    const latestMap: Record<string, any> = {};
    const res = await buildVarMappings({ nodeId, template: '{prompt}', latestMap, inputVars: [], autoDerive: true });
    expect(res.latestMap.file).toBeTruthy();
    expect(res.inputVars.find(v=> v.var === 'file')).toBeTruthy();
    listSpy.mockRestore();
  });

  it('skips unreferenced file when autoDerive disabled and not in template', async () => {
    const nodeId = 'LLM-2';
    const fileNode = { id: 'FR-2', type: 'FileReaderNode', props: { filePath: 'docs/sample2.txt', emitContent: true }, edges: { out: [ { id: 'e2', targetId: nodeId, kind: 'data', sourcePort: 'dataFile' } ] } } as any;
    const llmNode = { id: nodeId, type: 'LLM', props: {}, edges: { out: [] } } as any;
    const nodes = [fileNode, llmNode];
    vi.spyOn(nodeRepo, 'listNodes').mockResolvedValue(nodes as any);
    vi.spyOn(fileScanner, 'readFileSafe').mockResolvedValue({ ok: true, content: Buffer.from('ShouldNotLoad'), stat: { size: 12 } } as any);
    const latestMap: Record<string, any> = {};
    const res = await buildVarMappings({ nodeId, template: '{prompt}', latestMap, inputVars: [], autoDerive: false });
    // Because autoDerive false and template has no {dataFile}, no cold pull
    expect(res.latestMap.dataFile).toBeUndefined();
  });
});
