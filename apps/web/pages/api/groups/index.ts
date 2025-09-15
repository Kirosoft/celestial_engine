import type { NextApiRequest, NextApiResponse } from 'next';
import { sendError, methodNotAllowed } from '../../../lib/apiErrors';
import { nanoid } from 'nanoid';
import { FileRepo } from '../../../lib/fileRepo';
import { IndexRepo } from '../../../lib/indexRepo';
import { assertValidNode } from '../../../lib/validator';
import { GroupRepo } from '../../../lib/groupRepo';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'POST'){
      let { name, inputs = [], outputs = [] } = req.body || {};
      // Defensive: ensure arrays
      if(!Array.isArray(inputs) || !Array.isArray(outputs)){
        inputs = []; outputs = [];
      }
      // Seed minimal default ports if none specified so expansion shows proxies immediately
      if(inputs.length === 0 && outputs.length === 0){
        inputs = ['in'];
        outputs = ['out'];
      }
      // Basic validation (pattern + disjoint)
      const pattern = /^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/;
      const bad = [...inputs, ...outputs].filter(p=>!pattern.test(p));
      if(bad.length){
        return res.status(400).json({ error: { code: 'invalid_port_name', message: 'Invalid port name(s): '+bad.join(',') } });
      }
  const overlap = (inputs as string[]).filter((p: string)=> (outputs as string[]).includes(p));
      if(overlap.length){
        return res.status(400).json({ error: { code: 'ports_not_disjoint', message: 'Input/output port names must be disjoint: '+overlap.join(',') } });
      }
  // Build group node id upfront
  const id = `Group-${nanoid(6)}`;
  const subgraphRef = `groups/${id}`;
  const groupNode = { id, type: 'Group', name: name || id, props: {}, position: { x:120, y:120 }, edges: { out: [] }, ports: { inputs, outputs }, subgraphRef } as any;
  await assertValidNode(groupNode);
  await FileRepo.writeJson(`nodes/${id}.json`, groupNode);
  await IndexRepo.addOrUpdateNodeIndex(groupNode);
  // Initialize subgraph directory + proxy nodes (after we know id)
  await GroupRepo.initGroup({ id, inputs, outputs });
      // Emit refresh event via simple SSE or websocket (not implemented yet) placeholder
  return res.status(201).json({ group: groupNode });
    }
    return methodNotAllowed(res);
  } catch(e){
    // Provide richer diagnostics in test failures
    console.warn('[groups.create] error', e);
    return sendError(res, e);
  }
}
