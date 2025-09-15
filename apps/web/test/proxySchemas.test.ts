/** @vitest-environment node */
import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { getNodeTypeSchema, reloadSchemas } from '../lib/schemaLoader';

// Ensures proxy schemas at monorepo root (../../schemas/nodes) are discoverable.

describe('Proxy node schemas', () => {
  beforeAll(async () => {
    // Point REPO_ROOT at monorepo root so default pattern finds schemas/nodes/*.schema.json
    const repoRoot = resolve(process.cwd(), '..', '..');
    process.env.REPO_ROOT = repoRoot;
    process.env.SCHEMA_PATHS = 'schemas/nodes/*.schema.json';
    await reloadSchemas();
  });

  it.skip('loads GroupInputProxy schema', async () => {
    const s = await getNodeTypeSchema('GroupInputProxy');
    expect(s).toBeDefined();
    expect(s.title).toBe('GroupInputProxy');
  });

  it.skip('loads GroupOutputProxy schema', async () => {
    const s = await getNodeTypeSchema('GroupOutputProxy');
    expect(s).toBeDefined();
    expect(s.title).toBe('GroupOutputProxy');
  });
});
