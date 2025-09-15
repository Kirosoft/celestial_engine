import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed } from '../../../../../../lib/apiErrors';
import { FileRepo } from '../../../../../../lib/fileRepo';
import { GroupRepo } from '../../../../../../lib/groupRepo';

// GET /api/groups/:id/nodes/:nodeId - fetch a node (proxy or real) inside group subgraph
export default async function handler(req: NextApiRequest, res: NextApiResponse){
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
  return methodNotAllowed(res);
}
