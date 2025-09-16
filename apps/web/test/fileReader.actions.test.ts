import { describe, it, beforeAll, expect } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { createNode, updateNode, getNode } from '../lib/nodeRepo';
import { runNode } from '../lib/execution';

const tmpRoot = resolve(process.cwd(), '.test-filereader-actions');

async function ensureTmpFiles(){
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.writeFile(resolve(tmpRoot, 'a.txt'), 'Alpha file');
  await fs.writeFile(resolve(tmpRoot, 'b.log'), 'Bravo file');
  await fs.writeFile(resolve(tmpRoot, 'c.png'), new Uint8Array([0,1,2,3,4]));
}

describe('FileReaderNode actions', () => {
  beforeAll(async () => {
    process.env.REPO_ROOT = resolve(process.cwd(), '../../'); // repo root at project root level
    await ensureTmpFiles();
  });

  it('scans directory and iterates files with next', async () => {
    const node = await createNode('FileReaderNode', undefined, { mode: 'directory', dirPath: resolve(tmpRoot).replace(process.env.REPO_ROOT!,'').replace(/^\\|\//,'') });
    // Trigger scan
    await updateNode(node.id, { props: { ...node.props, action: 'scan', includePatterns: '*.txt,*.log' } });
  const scanRun: any = await runNode(node.id);
    const afterScan = await getNode(node.id) as any;
    expect(afterScan.props.scannedFiles.length).toBe(2); // a.txt, b.log
    expect(afterScan.props.cursorIndex).toBe(-1);

    // First next
    await updateNode(node.id, { props: { ...afterScan.props, action: 'next', emitContent: true, encodedAs: 'text' } });
  const next1: any = await runNode(node.id);
    const afterNext1 = await getNode(node.id) as any;
    expect(afterNext1.props.cursorIndex).toBe(0);
  expect((next1.emissions?.[0]?.value?.path || '')).toContain('a.txt');
    // Second next
    await updateNode(node.id, { props: { ...afterNext1.props, action: 'next', emitContent: true, encodedAs: 'text' } });
  const next2: any = await runNode(node.id);
    const afterNext2 = await getNode(node.id) as any;
    expect(afterNext2.props.cursorIndex).toBe(1);
  expect((next2.emissions?.[0]?.value?.path || '')).toContain('b.log');

    // Third next (end-of-list) should not advance
    await updateNode(node.id, { props: { ...afterNext2.props, action: 'next' } });
  const next3: any = await runNode(node.id);
    const afterNext3 = await getNode(node.id) as any;
    expect(afterNext3.props.cursorIndex).toBe(1); // unchanged
  expect(!next3.emissions || next3.emissions.length === 0).toBeTruthy();
  });

  it('sendNext wraps directory iteration after end', async () => {
    const node = await createNode('FileReaderNode', undefined, { mode: 'directory', dirPath: resolve(tmpRoot).replace(process.env.REPO_ROOT!,'').replace(/^\\|\//,'') });
    // scan
    await updateNode(node.id, { props: { ...node.props, action: 'scan', includePatterns: '*.txt,*.log' } });
    await runNode(node.id);
    let after = await getNode(node.id) as any;
    expect(after.props.scannedFiles.length).toBe(2);
    // first sendNext -> index 0
    await updateNode(node.id, { props: { ...after.props, action: 'sendNext', emitContent: true, encodedAs: 'text' } });
    const r1: any = await runNode(node.id); after = await getNode(node.id) as any;
    expect(after.props.cursorIndex).toBe(0);
    expect(r1.emissions?.[0]?.value?.index).toBe(0);
    // second sendNext -> index 1
    await updateNode(node.id, { props: { ...after.props, action: 'sendNext', emitContent: true, encodedAs: 'text' } });
    const r2: any = await runNode(node.id); after = await getNode(node.id) as any;
    expect(after.props.cursorIndex).toBe(1);
    expect(r2.emissions?.[0]?.value?.index).toBe(1);
    // third sendNext -> wrap to 0
    await updateNode(node.id, { props: { ...after.props, action: 'sendNext', emitContent: true, encodedAs: 'text' } });
    const r3: any = await runNode(node.id); after = await getNode(node.id) as any;
    expect(after.props.cursorIndex).toBe(0);
    expect(r3.emissions?.[0]?.value?.index).toBe(0);
    expect(r3.emissions?.[0]?.value?.wrapped).toBe(true);
  });

  it('sendNext reads single file similarly to read', async () => {
    const rel = resolve(tmpRoot, 'b.log').replace(process.env.REPO_ROOT!,'').replace(/^\\|\//,'');
    const node = await createNode('FileReaderNode', undefined, { mode: 'single', filePath: rel, emitContent: true, encodedAs: 'text' });
    await updateNode(node.id, { props: { ...node.props, action: 'sendNext' } });
    const run: any = await runNode(node.id);
    expect((run.emissions?.[0]?.value?.path || '')).toContain('b.log');
  });

  it('reads single file in single mode', async () => {
    const rel = resolve(tmpRoot, 'a.txt').replace(process.env.REPO_ROOT!,'').replace(/^\\|\//,'');
    const node = await createNode('FileReaderNode', undefined, { mode: 'single', filePath: rel, emitContent: true, encodedAs: 'text' });
    await updateNode(node.id, { props: { ...node.props, action: 'read' } });
    const run: any = await runNode(node.id);
    expect((run.emissions?.[0]?.value?.content || '')).toContain('Alpha');
  });

  it('omits content for oversized file', async () => {
    // create large file > default 512000
    const bigPath = resolve(tmpRoot, 'big.txt');
  const buf = new Uint8Array(520000).fill(65); // 'A'
  await fs.writeFile(bigPath, buf);
    const rel = bigPath.replace(process.env.REPO_ROOT!,'').replace(/^\\|\//,'');
    const node = await createNode('FileReaderNode', undefined, { mode: 'single', filePath: rel, emitContent: true, encodedAs: 'text' });
    await updateNode(node.id, { props: { ...node.props, action: 'read' } });
    const run: any = await runNode(node.id);
    const emission = run.emissions?.[0]?.value;
    expect(emission?.size).toBeGreaterThan(512000);
    expect(emission?.content).toBeUndefined();
  });
});
