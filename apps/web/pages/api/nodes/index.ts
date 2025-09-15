import type { NextApiRequest, NextApiResponse } from 'next';
import { listNodes, createNode } from '../../../lib/nodeRepo';
import { scanAndRepairDanglingEdges } from '../../../lib/integrityGuard';
import { sendError, methodNotAllowed } from '../../../lib/apiErrors';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'GET'){
  const report = await scanAndRepairDanglingEdges();
  const nodes = await listNodes();
  return res.status(200).json({ nodes, integrity: report });
    }
    if(req.method === 'POST'){
      const { type, name, props } = req.body || {};
      if(!type) return res.status(400).json({ error: { code: 'missing_type', message: 'type is required' } });
      if(type === 'Group'){
        return res.status(400).json({ error: { code: 'use_group_endpoint', message: 'Create Group nodes via POST /api/groups' } });
      }
      try {
        const node = await createNode(type, name, props||{});
        return res.status(201).json({ node });
      } catch(err){
        console.error('[POST /api/nodes] create error', err);
        throw err; // upstream catch will format
      }
    }
    return methodNotAllowed(res);
  } catch(e){
    return sendError(res, e);
  }
}