import type { NextApiRequest, NextApiResponse } from 'next';
import { emitFrom } from '../../../../lib/execution';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return res.status(405).json({ error: { code:'method_not_allowed' } });
  const { id } = req.query; if(typeof id !== 'string') return res.status(400).json({ error: { code:'bad_id' } });
  const { port, value } = req.body || {};
  if(!port) return res.status(400).json({ error: { code:'missing_port' } });
  try {
    console.debug('[api emit] request', { id, port, valuePreview: typeof value === 'string' ? value.slice(0,60) : value });
    await emitFrom(id, port, value);
    res.status(200).json({ ok: true });
  } catch(e: any){
    res.status(500).json({ error: { code:'emit_failed', message: e?.message || 'error' } });
  }
}
