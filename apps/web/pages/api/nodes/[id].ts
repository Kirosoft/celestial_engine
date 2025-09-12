import type { NextApiRequest, NextApiResponse } from 'next';
import { getNode, updateNode, deleteNode } from '../../../lib/nodeRepo';
import { sendError, methodNotAllowed } from '../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { id } = req.query;
  if(typeof id !== 'string') return res.status(400).json({ error: { code: 'bad_id', message: 'Invalid id param' } });
  try {
    if(req.method === 'GET'){
      const node = await getNode(id);
      return res.status(200).json({ node });
    }
    if(req.method === 'PUT'){
      const patch = req.body || {};
      const node = await updateNode(id, patch);
      return res.status(200).json({ node });
    }
    if(req.method === 'DELETE'){
      await deleteNode(id);
      return res.status(204).end();
    }
    return methodNotAllowed(res);
  } catch(e){
    return sendError(res, e);
  }
}