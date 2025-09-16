import { describe, it, expect, beforeAll } from 'vitest';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';
import { reloadSchemas } from '../lib/schemaLoader';
import { createNode } from '../lib/nodeRepo';
import { updateNode } from '../lib/nodeRepo';
import { promises as fs } from 'fs';
import { resolve } from 'path';

const tmpRoot = resolve(process.cwd(), '.test-filereader-schema');

describe('FileReaderNode schema validation', () => {
  beforeAll(async () => {
    process.env.REPO_ROOT = tmpRoot;
    await fs.rm(tmpRoot, { recursive: true, force: true });
    await fs.mkdir(tmpRoot, { recursive: true });
    await seedBaseSchemasIfNeeded();
    // Overwrite permissive seeded FileReaderNode schema with the committed strict schema
    const rootSchema = resolve(process.cwd(), '../../schemas/nodes/FileReaderNode.schema.json');
    const destSchemaDir = resolve(tmpRoot, 'schemas/nodes');
    await fs.mkdir(destSchemaDir, { recursive: true });
    const destSchema = resolve(destSchemaDir, 'FileReaderNode.schema.json');
    await fs.copyFile(rootSchema, destSchema);
    await reloadSchemas();
  });

  it('creates single mode node (requires filePath before emission but not at create)', async () => {
    const node = await createNode('FileReaderNode');
    expect(node.type).toBe('FileReaderNode');
    // Add filePath and persist to satisfy single-mode requirement
    const patched = await updateNode(node.id, { props: { ...(node.props||{}), mode: 'single', filePath: 'sample.txt' } });
    expect(patched.props?.filePath).toBe('sample.txt');
  });

  it('validates directory mode requires dirPath', async () => {
    const node = await createNode('FileReaderNode');
    // Switch to directory mode without dirPath should fail on update
    let err: any;
    try {
      await updateNode(node.id, { props: { ...(node.props||{}), mode: 'directory' } });
    } catch(e){ err = e; }
    expect(err, 'should error without dirPath').toBeTruthy();
    // Provide dirPath
    const ok = await updateNode(node.id, { props: { ...(node.props||{}), mode: 'directory', dirPath: '.' } });
    expect(ok.props?.dirPath).toBe('.');
  });

  it('coerces invalid mode to single', async () => {
    const node = await createNode('FileReaderNode', undefined, { mode: 'weird' });
    expect(node.props?.mode).toBe('single');
  });
});
