import type { NextApiRequest, NextApiResponse } from 'next';
import { updateNodePosition } from '../../../../lib/nodeRepo';
import { sendError, methodNotAllowed } from '../../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return methodNotAllowed(res);
  const { id } = req.query;
  if(typeof id !== 'string') return res.status(400).json({ error: { code: 'bad_id', message: 'Invalid id param' } });
  const { x, y } = req.body || {};
  if(typeof x !== 'number' || typeof y !== 'number') return res.status(400).json({ error: { code: 'bad_position', message: 'x and y numbers required' } });
  try {
    console.debug('[api position] request', { id, x, y });
    const node = await updateNodePosition(id, { x, y });
    console.debug('[api position] updated', { id, pos: node.position });
    res.status(200).json({ node });
  } catch(e){
    console.error('[api position] error', e);
    sendError(res, e);
  }
}