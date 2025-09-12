import type { NextApiRequest, NextApiResponse } from 'next';
import { renameNode } from '../../../../lib/nodeRepo';
import { sendError, methodNotAllowed } from '../../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if(req.method !== 'POST') return methodNotAllowed(res);
  const { id } = req.query;
  if(typeof id !== 'string') return res.status(400).json({ error: { code: 'bad_id', message: 'Invalid id param' } });
  const { newId } = req.body || {};
  if(!newId) return res.status(400).json({ error: { code: 'missing_newId', message: 'newId required' } });
  try {
    const node = await renameNode(id, newId);
    res.status(200).json({ node });
  } catch(e){
    sendError(res, e);
  }
}