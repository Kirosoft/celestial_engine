import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed } from '../../../../../lib/apiErrors';
import { FileRepo } from '../../../../../lib/fileRepo';
import { GroupRepo } from '../../../../../lib/groupRepo';
import { promises as fs } from 'fs';
import { resolve } from 'path';

interface GroupEdge { id: string; sourceId: string; targetId: string; kind: string }

async function load(groupId: string){
  const root = FileRepo.safeJoin(GroupRepo.groupRoot(groupId));
  const edgePath = resolve(root, 'edges.json');
  try { await fs.access(edgePath); } catch { await fs.writeFile(edgePath, '[]', 'utf8'); }
  const raw = await fs.readFile(edgePath, 'utf8');
  return { edgePath, edges: JSON.parse(raw) as GroupEdge[] };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { id: groupId, edgeId } = req.query as { id: string; edgeId: string };
  if(req.method === 'PUT' || req.method === 'DELETE'){
  const groupExists = await GroupRepo.existsGroup(groupId);
    if(!groupExists){
      return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
    }
    const { edgePath, edges } = await load(groupId);
    const idx = edges.findIndex(e=> e.id === edgeId);
    if(idx === -1){
      return res.status(404).json({ error: { code: 'edge_not_found', message: `Edge ${edgeId} not found` } });
    }
    if(req.method === 'PUT'){
      const patch = req.body || {};
      edges[idx] = { ...edges[idx], ...patch, id: edges[idx].id };
      await fs.writeFile(edgePath, JSON.stringify(edges, null, 2));
      return res.status(200).json({ edge: edges[idx] });
    } else {
      edges.splice(idx, 1);
      await fs.writeFile(edgePath, JSON.stringify(edges, null, 2));
      return res.status(204).end();
    }
  }
  return methodNotAllowed(res);
}
