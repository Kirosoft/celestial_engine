import type { NextApiRequest, NextApiResponse } from 'next';
import { runNode, emitFrom } from '../../../../lib/execution';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return res.status(405).json({ error: { code:'method_not_allowed' } });
  const { id } = req.query;
  if(typeof id !== 'string') return res.status(400).json({ error: { code:'bad_id', message:'id required' } });
  try {
    console.debug('[api run] start', { nodeId: id });
    const result = await runNode(id, { mode: 'runtime' });
    if(result.error){
      console.debug('[api run] error', { nodeId: id, error: result.error });
      return res.status(400).json(result);
    }
    const emissions = (result as any).emissions;
    if(Array.isArray(emissions)){
      for(const em of emissions){
        try {
          console.debug('[api run] emitting', { nodeId: id, port: em.port, hasValue: em.value !== undefined });
          await emitFrom(id, em.port, em.value);
        } catch(err:any){
          console.error('[api run] emit error', { nodeId: id, port: em.port, error: err?.message });
        }
      }
    }
  console.debug('[api run] done', { nodeId: id, emissions: Array.isArray(emissions) ? emissions.length : 0 });
    res.status(200).json(result);
  } catch(e:any){
    console.error('[api run] exception', { nodeId: id, error: e?.message });
    res.status(500).json({ error: { code:'run_failed', message: e?.message || 'error' } });
  }
}
