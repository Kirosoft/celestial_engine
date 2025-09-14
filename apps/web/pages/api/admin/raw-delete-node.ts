import type { NextApiRequest, NextApiResponse } from 'next';
import { FileRepo } from '../../../lib/fileRepo';
import { promises as fs } from 'fs';
import { join } from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return res.status(405).json({ error: { code: 'method_not_allowed' }});
  const rootEnv = (process.env.REPO_ROOT || '').trim();
  const isE2E = process.env.E2E === '1' || process.env.PW_TEST || rootEnv.includes('.e2e-root');
  if(!isE2E){
    return res.status(403).json({ error: { code: 'forbidden', env: { E2E: process.env.E2E, PW_TEST: process.env.PW_TEST, REPO_ROOT: rootEnv } }});
  }
  const { id } = req.body || {};
  if(!id) return res.status(400).json({ error: { code: 'missing_id' }});
  try {
    // Direct file removal WITHOUT repairing edges to simulate dangling edge scenario.
    const p = FileRepo.safeJoin(`nodes/${id}.json`);
    await fs.unlink(p);
    return res.status(200).json({ ok: true, removed: id });
  } catch (e: any){
    return res.status(500).json({ error: { code: 'delete_failed', message: e?.message || 'unknown' }});
  }
}
