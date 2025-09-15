import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { reloadSchemas } from '../lib/schemaLoader';
import { validateNode } from '../lib/validator';

// Use real repository root (do not override REPO_ROOT) so we load actual Group.schema.json

async function ensureGroupSchemaPresent(){
  // The real schemas live at repo root (../../schemas from apps/web)
  const repoRoot = resolve(process.cwd(), '..', '..');
  const file = resolve(repoRoot, 'schemas/nodes/Group.schema.json');
  const exists = await fs.access(file).then(()=>true).catch(()=>false);
  if(!exists) throw new Error('Expected Group.schema.json to exist at ' + file);
  await reloadSchemas();
}

describe('Group schema validation', () => {
  beforeAll(async () => {
    // Point REPO_ROOT at monorepo root so default loader pattern finds schemas/nodes/Group.schema.json
    const repoRoot = resolve(process.cwd(), '..', '..');
    process.env.REPO_ROOT = repoRoot;
    process.env.SCHEMA_PATHS = 'schemas/nodes/*.schema.json';
    await ensureGroupSchemaPresent();
  });

  it('accepts a minimal valid Group node', async () => {
    const node = {
      id: 'Group-1',
      type: 'Group',
      name: 'My Group',
      ports: { inputs: [], outputs: ['result'] },
      position: { x: 0, y: 0 },
      edges: { out: [] },
      props: {}
    };
    const r = await validateNode(node);
    expect(r.valid).toBe(true);
  });

  it('(placeholder) accepts arbitrary port names until pattern constraints are reintroduced', async () => {
    const node = {
      id: 'Group-2',
      type: 'Group',
      name: 'No Pattern Group',
      ports: { inputs: ['1bad'], outputs: [] }, // Currently allowed by schema (no pattern constraint)
      position: { x: 0, y: 0 },
      edges: { out: [] },
      props: {}
    };
    const r = await validateNode(node);
    expect(r.valid).toBe(true);
    // TODO: When a pattern is added to Group.schema.json for port names, flip this expectation.
  });

  it('allows disjointness enforcement to be handled externally (same name in inputs & outputs passes schema)', async () => {
    const node = {
      id: 'Group-3',
      type: 'Group',
      name: 'Overlap Group',
      ports: { inputs: ['x'], outputs: ['x'] }, // schema itself allows; app logic will reject later
      position: { x: 0, y: 0 },
      edges: { out: [] },
      props: {}
    };
    const r = await validateNode(node);
    expect(r.valid).toBe(true);
  });
});
