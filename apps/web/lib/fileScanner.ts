import { promises as fs } from 'fs';
import { resolve, relative, sep } from 'path';

export interface ScanOptions {
  dirPath: string;              // user-provided path (relative or absolute)
  includePatterns?: string;     // comma or newline separated globs
  repoRoot: string;             // REPO_ROOT environment or configured base
  recursive?: boolean;          // future (unused MVP)
}
export interface ScannedFileMeta {
  relativePath: string; // path relative to dir root provided
  absolutePath: string; // internal, not to emit externally (unless debugging)
  size: number;
  modifiedMs: number;
}

// Very small glob subset: * matches any chars except path separator; supports multiple comma/newline patterns.
function compilePatterns(patterns: string[]): ((name: string) => boolean) {
  if(!patterns.length) return () => true;
  const regexes = patterns.map(p => {
    const trimmed = p.trim();
    if(!trimmed || trimmed === '*') return /^.*$/i;
    // Escape regex special except * then replace * with .*
    const esc = trimmed.replace(/[.+?^${}()|\\]/g, r => `\\${r}`).replace(/\*/g, '.*');
    return new RegExp('^' + esc + '$', 'i');
  });
  return (name: string) => regexes.some(r => r.test(name));
}

export function parsePatternList(raw?: string): string[] {
  if(!raw) return ['*'];
  const tokens = raw.split(/[\n,]/).map(t => t.trim()).filter(Boolean);
  return tokens.length ? tokens : ['*'];
}

export async function scanDirectory(opts: ScanOptions): Promise<{ files: ScannedFileMeta[]; error?: string }>{
  const { dirPath, includePatterns, repoRoot } = opts;
  try {
    const root = resolve(repoRoot);
    const target = resolve(root, dirPath);
    if(!target.startsWith(root)){
      return { files: [], error: 'path_outside_repo_root' };
    }
    const stat = await fs.stat(target).catch(()=> null);
    if(!stat) return { files: [], error: 'dir_not_found' };
    if(!stat.isDirectory()) return { files: [], error: 'not_a_directory' };
    const entries = await fs.readdir(target, { withFileTypes: true });
    const patterns = parsePatternList(includePatterns);
    const match = compilePatterns(patterns);
    const acc: ScannedFileMeta[] = [];
    for(const e of entries){
      if(!e.isFile()) continue; // MVP: files only, no recursion
      const rel = e.name;
      if(!match(rel)) continue;
      const abs = resolve(target, rel);
      const fst = await fs.stat(abs).catch(()=> null);
      if(!fst) continue;
      acc.push({ relativePath: rel, absolutePath: abs, size: fst.size, modifiedMs: fst.mtimeMs });
    }
    acc.sort((a,b)=> a.relativePath.localeCompare(b.relativePath));
    return { files: acc };
  } catch(err:any){
    return { files: [], error: 'scan_failed:' + (err?.message || 'unknown') };
  }
}

export async function readFileSafe(repoRoot: string, filePath: string): Promise<{ ok: boolean; abs?: string; error?: string; content?: Buffer; stat?: { size: number; mtimeMs: number } }>{
  try {
    const root = resolve(repoRoot);
    const abs = resolve(root, filePath);
    if(!abs.startsWith(root)) return { ok: false, error: 'path_outside_repo_root' };
    const st = await fs.stat(abs).catch(()=> null);
    if(!st) return { ok: false, error: 'not_found' };
    if(!st.isFile()) return { ok: false, error: 'not_a_file' };
    const buf = await fs.readFile(abs);
    return { ok: true, abs, content: buf, stat: { size: st.size, mtimeMs: st.mtimeMs } };
  } catch(err:any){
    return { ok: false, error: 'read_failed:' + (err?.message || 'unknown') };
  }
}
