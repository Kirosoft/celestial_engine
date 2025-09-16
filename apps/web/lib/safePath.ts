import { resolve } from 'path';

export interface SafePathResult { ok: boolean; abs?: string; rel?: string; error?: string }

export function resolveSafePath(repoRoot: string, input: string | undefined): SafePathResult {
  try {
    const root = resolve(repoRoot);
    const relInput = (input || '').replace(/\\/g,'/').replace(/^\/+/, '');
    const abs = resolve(root, relInput || '.');
    if(!abs.startsWith(root)) return { ok: false, error: 'path_outside_repo_root' };
    const rel = abs === root ? '' : abs.substring(root.length + 1).replace(/\\/g,'/');
    return { ok: true, abs, rel };
  } catch(err:any){
    return { ok: false, error: 'resolve_failed' };
  }
}
