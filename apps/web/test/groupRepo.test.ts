import { describe, it, expect, beforeEach } from 'vitest';
import { resolve } from 'path';
import { promises as fs } from 'fs';
import { GroupRepo } from '../lib/groupRepo';

const tmpRoot = resolve(process.cwd(), '.test-groupRepo');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
}

describe('GroupRepo', () => {
  beforeEach(async () => { await reset(); });

  it('initGroup creates proxy nodes for inputs and outputs', async () => {
    const { id } = await GroupRepo.initGroup({ inputs: ['inA'], outputs: ['outB','outC'] });
    const nodes = await GroupRepo.listGroupNodes(id);
    const ids = nodes.map(n=>n.id).sort();
    expect(ids).toContain('__input_inA');
    expect(ids).toContain('__output_outB');
    expect(ids).toContain('__output_outC');
  });
});
