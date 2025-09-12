import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FileRepo } from '../lib/fileRepo';
import { PathEscapeError } from '../lib/errors';
import { promises as fs } from 'fs';
import { resolve } from 'path';

const tmpRoot = resolve(process.cwd(), '.test-tmp');

describe('FileRepo', () => {
  beforeAll(async () => {
    process.env.REPO_ROOT = tmpRoot;
    await fs.mkdir(tmpRoot, { recursive: true });
  });
  afterAll(async () => {
    // cleanup
    try { await fs.rm(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  it('rejects path traversal', async () => {
    await expect(FileRepo.read('../escape.txt')).rejects.toBeInstanceOf(PathEscapeError);
  });

  it('write/read json round trip', async () => {
    const path = 'roundtrip.json';
    const obj = { a: 1, b: 'two' };
    await FileRepo.writeJson(path, obj);
    const back = await FileRepo.readJson<typeof obj>(path);
    expect(back).toEqual(obj);
  });

  it('overwrites existing file completely', async () => {
    const path = 'overwrite.txt';
    await FileRepo.write(path, 'first');
    await FileRepo.write(path, 'second');
    const content = await FileRepo.read(path);
    expect(content).toBe('second');
  });
});
