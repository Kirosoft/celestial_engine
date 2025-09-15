import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';
import { createNode, addEdge } from '../lib/nodeRepo';
import { scanAndRepairDanglingEdges } from '../lib/integrityGuard';
import { FileRepo } from '../lib/fileRepo';

const tmpRoot = resolve(process.cwd(), '.integrity-test');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await seedBaseSchemasIfNeeded();
}

describe('Integrity Guard', () => {
  beforeEach(reset);

  it('removes dangling edge and reports repair', async () => {
    const a = await createNode('Task','A');
    const b = await createNode('Task','B');
    await addEdge(a.id, b.id);
    // Manually delete node b without cleaning inbound references
    await FileRepo.delete(`nodes/${b.id}.json`);
    const report = await scanAndRepairDanglingEdges();
    expect(report.totalRemoved).toBe(1);
    expect(report.repaired[0].nodeId).toBe(a.id);
  });

  it('no-op when graph clean', async () => {
    await createNode('Task','Solo');
    const report = await scanAndRepairDanglingEdges();
    expect(report.totalRemoved).toBe(0);
  });
});
