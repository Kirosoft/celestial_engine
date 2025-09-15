import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, sendError } from '../../../../../../lib/apiErrors';
import { FileRepo } from '../../../../../../lib/fileRepo';
import { GroupRepo } from '../../../../../../lib/groupRepo';
import { promises as fs } from 'fs';
import { resolve } from 'path';

// GET /api/groups/:id/nodes/:nodeId - fetch a node (proxy or real) inside group subgraph
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    const { id: groupId, nodeId } = req.query as { id: string; nodeId: string };
  if(req.method === 'GET'){
      const groupExists = await FileRepo.exists(`nodes/${groupId}.json`);
      if(!groupExists){
        return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
      }
      const path = `${GroupRepo.groupNodesDir(groupId)}/${nodeId}.json`;
      const exists = await FileRepo.exists(path);
      if(!exists){
        return res.status(404).json({ error: { code: 'group_node_not_found', message: `Node ${nodeId} not found in group ${groupId}` } });
      }
      const node = await FileRepo.readJson<any>(path);
      return res.status(200).json({ node });
    }
    if(req.method === 'PUT'){
      const groupExists = await FileRepo.exists(`nodes/${groupId}.json`);
      if(!groupExists){
        return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
      }
      const path = `${GroupRepo.groupNodesDir(groupId)}/${nodeId}.json`;
      const exists = await FileRepo.exists(path);
      if(!exists){
        return res.status(404).json({ error: { code: 'group_node_not_found', message: `Node ${nodeId} not found in group ${groupId}` } });
      }
      const node = await FileRepo.readJson<any>(path);
      if(node.type === 'GroupInputProxy' || node.type === 'GroupOutputProxy'){
        return res.status(400).json({ error: { code: 'cannot_edit_proxy', message: 'Proxy nodes cannot be edited directly.' } });
      }
      const patch = req.body || {};
      const updated = { ...node, ...patch, id: node.id, type: node.type };
      // Prevent changing subgraphRef or ports via this endpoint for Groups (future dedicated API)
      if(node.type === 'Group'){
        updated.subgraphRef = node.subgraphRef;
        updated.ports = node.ports;
      }
      // Basic invariant: position updates are handled elsewhere
      await FileRepo.writeJson(path, updated);
      return res.status(200).json({ node: updated });
    }
    if(req.method === 'DELETE'){
      // Validate group
      const groupExists = await FileRepo.exists(`nodes/${groupId}.json`);
      if(!groupExists){
        return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
      }
      const path = `${GroupRepo.groupNodesDir(groupId)}/${nodeId}.json`;
      const exists = await FileRepo.exists(path);
      if(!exists){
        return res.status(404).json({ error: { code: 'group_node_not_found', message: `Node ${nodeId} not found in group ${groupId}` } });
      }
      const node = await FileRepo.readJson<any>(path);
      // Forbid deletion of proxies (either by id pattern or type)
      if(node.type === 'GroupInputProxy' || node.type === 'GroupOutputProxy' || /^__input_/i.test(node.id) || /^__output_/i.test(node.id)){
        return res.status(400).json({ error: { code: 'cannot_delete_proxy', message: 'Proxy nodes cannot be deleted directly. Edit group ports instead.' } });
      }
      // If nested group, recursively remove its subgraph directory (groups/<nestedId>)
      if(node.type === 'Group' && node.subgraphRef){
        try {
          const subgraphDir = FileRepo.safeJoin(node.subgraphRef); // groups/<nestedId>
          await fs.rm(resolve(subgraphDir), { recursive: true, force: true });
        } catch(e){ /* ignore cleanup errors */ }
      }
      await FileRepo.delete(path);
      return res.status(204).end();
    }
    return methodNotAllowed(res);
  } catch(e){
    return sendError(res, e);
  }
}
