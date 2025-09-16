import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { resolveSafePath } from '../../../lib/safePath';

interface Entry { name: string; kind: 'file'|'dir'; size?: number; modifiedMs?: number }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'GET') return res.status(405).json({ error: { code: 'method_not_allowed' } });
  const repoRoot = resolve(process.env.REPO_ROOT || resolve(process.cwd(), '../../'));
  const qPath = Array.isArray(req.query.path) ? req.query.path[0] : (req.query.path || '');
  const safe = resolveSafePath(repoRoot, qPath as string);
  if(!safe.ok){
    return res.status(400).json({ error: { code: safe.error } });
  }
  try {
    const stat = await fs.stat(safe.abs!);
    if(!stat.isDirectory()){
      return res.status(400).json({ error: { code: 'not_a_directory' } });
    }
    const dirents = await fs.readdir(safe.abs!, { withFileTypes: true });
    const entries: Entry[] = [];
    for(const d of dirents){
      // skip hidden . prefixes except .env maybe (decision: allow all for now)
      const full = resolve(safe.abs!, d.name);
      try {
        const st = await fs.stat(full);
        if(d.isDirectory()) entries.push({ name: d.name, kind: 'dir', modifiedMs: st.mtimeMs });
        else if(d.isFile()) entries.push({ name: d.name, kind: 'file', size: st.size, modifiedMs: st.mtimeMs });
      } catch { /* ignore individual entry errors */ }
    }
    // sort: dirs first then files, each alphabetically
    entries.sort((a,b)=>{
      if(a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return res.status(200).json({ path: safe.rel || '', entries, parent: parentPath(safe.rel) });
  } catch(err:any){
    return res.status(500).json({ error: { code: 'fs_list_failed', message: err?.message } });
  }
}

function parentPath(rel?: string){
  if(!rel) return null;
  const parts = rel.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}
