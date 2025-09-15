import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { validateNode, assertValidNode } from '../lib/validator';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';

const tmpRoot = resolve(process.cwd(), '.test-validate');

async function reset(){
  process.env.REPO_ROOT = tmpRoot;
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await seedBaseSchemasIfNeeded();
}

describe('Validator', () => {
  beforeEach(async () => { await reset(); });

  it('validates a proper node', async () => {
    const result = await validateNode({ id: 'Task-1', type: 'Task', name: 'Task-1', props: {} });
    expect(result.valid).toBe(true);
  });

  it('rejects missing type (returns invalid)', async () => {
    try {
      const result = await validateNode({ id: 'x' } as any);
      expect(result.valid).toBe(false);
    } catch(e){
      // validateNode throws ValidationError for missing type currently
      expect((e as any).message).toMatch(/Validation failed/);
    }
  });

  it('throws on assertValidNode with invalid node', async () => {
    await expect(assertValidNode({ id: 'x' } as any)).rejects.toBeTruthy();
  });
});
