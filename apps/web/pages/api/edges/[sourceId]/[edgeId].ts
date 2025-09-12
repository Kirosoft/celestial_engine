import type { NextApiRequest, NextApiResponse } from 'next';
import { updateEdge, removeEdge } from '../../../../lib/nodeRepo';
import { sendError, methodNotAllowed } from '../../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { sourceId, edgeId } = req.query;
  if(typeof sourceId !== 'string' || typeof edgeId !== 'string') return res.status(400).json({ error: { code: 'bad_params', message: 'Invalid params' } });
  try {
    if(req.method === 'PUT'){
      const patch = req.body || {};
      const edge = await updateEdge(sourceId, edgeId, patch);
      return res.status(200).json({ edge });
    }
    if(req.method === 'DELETE'){
      await removeEdge(sourceId, edgeId);
      return res.status(204).end();
    }
    return methodNotAllowed(res);
  } catch(e){ sendError(res, e); }
}