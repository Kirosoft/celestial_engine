import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, sendError } from '../../../../lib/apiErrors';
import { FileRepo } from '../../../../lib/fileRepo';
import { assertValidNode } from '../../../../lib/validator';
import { GroupRepo } from '../../../../lib/groupRepo';
import { nanoid } from 'nanoid';

// POST /api/groups/:id/nodes
// Creates a node inside the group's subgraph directory (excluding proxies which are managed via ports API).
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'POST'){
      const { id: groupId } = req.query as { id: string };
      // Ensure group exists
      const exists = await FileRepo.exists(`nodes/${groupId}.json`);
      if(!exists){
        return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
      }
      const { type, name, props = {}, inputs = [], outputs = [] } = req.body || {};
      if(!type){
        return res.status(400).json({ error: { code: 'missing_type', message: 'type is required' } });
      }
      const nodeId = `${type}-${nanoid(6)}`;
      let node: any = { id: nodeId, type, name: name || nodeId, props, position: { x:180, y:140 }, edges: { out: [] } };
      // Nested group creation: if type === 'Group', persist ports + subgraphRef and seed proxies inside its own directory
      if(type === 'Group'){
        // Minimal port validation similar to root endpoint
        const pattern = /^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/;
        const bad = [...inputs, ...outputs].filter(p=>!pattern.test(p));
        if(bad.length){
          return res.status(400).json({ error: { code: 'invalid_port_name', message: 'Invalid port name(s): '+bad.join(',') } });
        }
        const overlap = (inputs as string[]).filter(p => (outputs as string[]).includes(p));
        if(overlap.length){
          return res.status(400).json({ error: { code: 'ports_not_disjoint', message: 'Input/output port names must be disjoint: '+overlap.join(',') } });
        }
        const subgraphRef = `groups/${nodeId}`;
        node = { ...node, ports: { inputs, outputs }, subgraphRef };
      }
      await assertValidNode(node);
      const path = `${GroupRepo.groupNodesDir(groupId)}/${node.id}.json`;
      await FileRepo.writeJson(path, node);
      if(type === 'Group'){
        // Initialize nested group's own subgraph (proxies creation)
        await GroupRepo.initGroup({ id: nodeId, inputs, outputs });
      }
      return res.status(201).json({ node });
    }
    return methodNotAllowed(res);
  } catch(e){
    return sendError(res, e);
  }
}