import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { FileRepo } from '../../../lib/fileRepo';

async function cleanDir(dir: string){
  const stat = await fs.stat(dir).catch(()=>null);
  if(!stat) return;
  const entries = await fs.readdir(dir);
  for(const e of entries){
    const p = join(dir, e);
    try {
      const st = await fs.stat(p).catch(()=>null); if(!st) continue;
      if(st.isDirectory()) await fs.rm(p, { recursive: true, force: true }); else await fs.unlink(p).catch(()=>{});
    } catch{}
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' }});
  try {
    const rootEnv = (process.env.REPO_ROOT || '').trim();
    if(!rootEnv) return res.status(400).json({ error: { code: 'missing_repo_root', message: 'REPO_ROOT not set' }});
    const isE2E = process.env.E2E === '1' || process.env.PW_TEST || rootEnv.includes('.e2e-root');
    if(!isE2E){
      return res.status(403).json({ error: { code: 'forbidden', message: 'reset only allowed in E2E mode', env: { E2E: process.env.E2E, PW_TEST: process.env.PW_TEST, REPO_ROOT: rootEnv } }});
    }
    const root = resolve(rootEnv);
    await cleanDir(join(root, 'nodes'));
    await cleanDir(join(root, '.awb'));
    await fs.writeFile(join(root, 'RESET_AT'), new Date().toISOString(), 'utf8');
    const remaining = await FileRepo.list('nodes/*.json');
    return res.status(200).json({ ok: true, nodes: remaining.length });
  } catch(e: any){
    return res.status(500).json({ error: { code: 'reset_failed', message: e?.message || 'unknown' }});
  }
}
