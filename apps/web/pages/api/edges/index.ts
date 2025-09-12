import type { NextApiRequest, NextApiResponse } from 'next';
import { addEdge } from '../../../lib/nodeRepo';
import { sendError, methodNotAllowed } from '../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return methodNotAllowed(res);
  const { sourceId, targetId, kind } = req.body || {};
  if(!sourceId || !targetId) return res.status(400).json({ error: { code: 'missing_ids', message: 'sourceId & targetId required' } });
  try {
    const edge = await addEdge(sourceId, targetId, kind || 'flow');
    res.status(201).json({ edge });
  } catch(e){ sendError(res, e); }
}