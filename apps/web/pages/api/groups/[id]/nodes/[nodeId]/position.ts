import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed } from '../../../../../../lib/apiErrors';
import { FileRepo } from '../../../../../../lib/fileRepo';
import { GroupRepo } from '../../../../../../lib/groupRepo';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { id: groupId, nodeId } = req.query as { id: string; nodeId: string };
  if(req.method === 'POST'){
    const groupExists = await FileRepo.exists(`nodes/${groupId}.json`);
    if(!groupExists){
      return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
    }
    const path = `${GroupRepo.groupNodesDir(groupId)}/${nodeId}.json`;
    const exists = await FileRepo.exists(path);
    if(!exists){
      return res.status(404).json({ error: { code: 'group_node_not_found', message: `Node ${nodeId} not found in group ${groupId}` } });
    }
    const body = req.body || {};
    const { x, y } = body;
    if(typeof x !== 'number' || typeof y !== 'number'){
      return res.status(400).json({ error: { code: 'invalid_position', message: 'x and y must be numbers' } });
    }
    const node = await FileRepo.readJson<any>(path);
    node.position = { x, y };
    await FileRepo.writeJson(path, node);
    return res.status(200).json({ node });
  }
  return methodNotAllowed(res);
}