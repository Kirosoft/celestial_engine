import type { NextApiRequest, NextApiResponse } from 'next';
import { runNode } from '../../../../lib/execution';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return res.status(405).json({ error: { code:'method_not_allowed' } });
  const { id } = req.query;
  if(typeof id !== 'string') return res.status(400).json({ error: { code:'bad_id', message:'id required' } });
  try {
    const result = await runNode(id, { mode: 'runtime' });
    if(result.error) return res.status(400).json(result);
    res.status(200).json(result);
  } catch(e:any){
    res.status(500).json({ error: { code:'run_failed', message: e?.message || 'error' } });
  }
}
