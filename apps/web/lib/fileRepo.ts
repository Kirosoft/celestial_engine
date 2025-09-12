import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import fg from 'fast-glob';
import { PathEscapeError } from './errors';

function repoRoot(){
  return process.env.REPO_ROOT ? resolve(process.env.REPO_ROOT) : resolve(process.cwd());
}

function safeJoin(p: string){
  const root = repoRoot();
  const target = resolve(root, p);
  if(!target.startsWith(root)) throw new PathEscapeError(p);
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
  return fg(glob, { cwd: repoRoot(), dot: false });
}

export async function readJson<T=any>(path: string): Promise<T>{
  const raw = await read(path);
  return JSON.parse(raw) as T;
}

export async function writeJson(path: string, obj: any){
  await write(path, JSON.stringify(obj, null, 2)+'\n');
}

export const FileRepo = { read, write, exists, delete: del, list, readJson, writeJson, safeJoin };
