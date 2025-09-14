import { promises as fs } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import fg from 'fast-glob';
import { PathEscapeError } from './errors';

async function debugLog(msg: string) {
  // Compute repo root here without calling repoRoot() to avoid recursion
  const envRoot = (process.env.REPO_ROOT || '').trim();
  const root = envRoot ? resolve(envRoot) : resolve(process.cwd());
  const debugFile = join(root, 'debug-paths.txt');
  try {
    await fs.appendFile(debugFile, msg + '\n');
  } catch (err) {
    // If the directory doesn't exist, create it
    await fs.mkdir(root, { recursive: true });
    await fs.appendFile(debugFile, msg + '\n');
  }
}

function repoRoot(){
  const envRoot = (process.env.REPO_ROOT || '').trim();
  const isE2E = !!process.env.PW_TEST || process.env.NODE_ENV === 'test' || process.env.E2E === '1';
  if(!envRoot && isE2E){
    // Hard fail in E2E context to surface isolation issues early
    const msg = '[FileRepo] ERROR: REPO_ROOT not set during E2E/test execution. Refusing to fall back to project root.';
    debugLog(msg);
    throw new Error(msg);
  }
  const resolved = envRoot ? resolve(envRoot) : resolve(process.cwd());
  if(!envRoot){
    debugLog('[FileRepo] WARNING: REPO_ROOT not set – using process.cwd() fallback.');
  }
  debugLog(`[FileRepo] repoRoot() env: ${envRoot} resolved: ${resolved}`);
  return resolved;
}

function safeJoin(p: string){
  const root = repoRoot();
  // If p is absolute, use it directly; otherwise resolve against root
  const target = isAbsolute(p) ? resolve(p) : resolve(root, p);
  debugLog(`[FileRepo] safeJoin() root: ${root} p: ${p} target: ${target}`);
  const rel = relative(root, target);
  // If the relative path starts with '..' then target is outside root
  if (rel === '' || (rel && !rel.split(/\\|\//).includes('..')) === false) {
    // fallthrough to check below
  }
  if (rel.startsWith('..') || rel === '..' || rel.split(/\\|\//)[0] === '..') {
    throw new PathEscapeError(p);
  }
  return target;
}

export async function read(path: string){
  return fs.readFile(safeJoin(path), 'utf8');
}

export async function write(path: string, content: string){
  const full = safeJoin(path);
  await fs.mkdir(resolve(full, '..'), { recursive: true });
  const tmp = full + '.tmp-'+Date.now();
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, full);
}

export async function exists(path: string){
  try { await fs.access(safeJoin(path)); return true; } catch { return false; }
}

export async function del(path: string){
  try { await fs.unlink(safeJoin(path)); } catch {}
}

export async function list(glob: string){
  const cwd = repoRoot();
  await debugLog(`[FileRepo] list() cwd: ${cwd} glob: ${glob}`);
  const result = await fg(glob, { cwd, dot: false });
  await debugLog(`[FileRepo] list() result: ${JSON.stringify(result)}`);
  return result;
}

export async function readJson<T=any>(path: string): Promise<T>{
  const raw = await read(path);
  return JSON.parse(raw) as T;
}

export async function writeJson(path: string, obj: any){
  await write(path, JSON.stringify(obj, null, 2)+'\n');
}

export const FileRepo = { read, write, exists, delete: del, list, readJson, writeJson, safeJoin };
