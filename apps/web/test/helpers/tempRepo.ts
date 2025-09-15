import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { seedBaseSchemasIfNeeded } from './seedBaseSchemas';

export interface TempRepoOptions {
  prefix?: string;        // directory name prefix
  seedSchemas?: boolean;  // auto-seed base schemas
}

export interface TempRepoHandle {
  root: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates an isolated temporary repository root, sets process.env.REPO_ROOT,
 * optionally seeds base schemas, and returns a cleanup handle.
 * Each test suite should call this in beforeAll (or first beforeEach for isolation).
 */
export async function createTempRepo(opts: TempRepoOptions = {}): Promise<TempRepoHandle> {
  const prefix = opts.prefix || 'repo-';
  const dir = await mkdtemp(join(tmpdir(), prefix));
  process.env.REPO_ROOT = dir;
  // Provide a default schema glob so loader finds schemas we seed
  if(!process.env.SCHEMA_PATHS) process.env.SCHEMA_PATHS = 'schemas/nodes/*.schema.json';
  if(opts.seedSchemas) {
    await seedBaseSchemasIfNeeded();
  }
  return {
    root: dir,
    cleanup: async () => {
      // best-effort removal
      await rm(dir, { recursive: true, force: true });
    }
  };
}

/** Convenience wrapper that both creates and seeds */
export async function createSeededTempRepo(prefix?: string){
  return createTempRepo({ prefix, seedSchemas: true });
}
