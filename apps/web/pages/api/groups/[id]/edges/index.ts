import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed } from '../../../../../lib/apiErrors';
import { FileRepo } from '../../../../../lib/fileRepo';
import { GroupRepo } from '../../../../../lib/groupRepo';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { nanoid } from 'nanoid';
import { CycleError } from '../../../../../lib/errors';

interface GroupEdge { id: string; sourceId: string; targetId: string; kind: string }

async function loadEdgesDir(groupId: string){
  const root = FileRepo.safeJoin(GroupRepo.groupRoot(groupId));
  const edgePath = resolve(root, 'edges.json');
  try { await fs.access(edgePath); } catch { await fs.writeFile(edgePath, '[]', 'utf8'); }
  const raw = await fs.readFile(edgePath, 'utf8');
  return { edgePath, edges: JSON.parse(raw) as GroupEdge[] };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { id: groupId } = req.query as { id: string };
  if(req.method === 'POST'){
    const { sourceId, targetId, kind='flow' } = req.body || {};
    if(!sourceId || !targetId){
      return res.status(400).json({ error: { code: 'missing_ids', message: 'sourceId & targetId required' } });
    }
    if(sourceId === targetId){
      return res.status(409).json({ error: { code: 'cycle', message: 'Self-loop not allowed' } });
    }
    // Validate group & nodes
  const groupExists = await GroupRepo.existsGroup(groupId);
    if(!groupExists){
      return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${groupId}` } });
    }
    const sourcePath = `${GroupRepo.groupNodesDir(groupId)}/${sourceId}.json`;
    const targetPath = `${GroupRepo.groupNodesDir(groupId)}/${targetId}.json`;
    if(!(await FileRepo.exists(sourcePath)) || !(await FileRepo.exists(targetPath))){
      return res.status(404).json({ error: { code: 'node_not_found', message: 'Source or target not found in group' } });
    }
    const { edgePath, edges } = await loadEdgesDir(groupId);
    // Cycle detection within subgroup
    // Build adjacency from existing edges plus proposed edge
    const adjacency = new Map<string, string[]>();
    for(const e of edges){
      if(!adjacency.has(e.sourceId)) adjacency.set(e.sourceId, []);
      adjacency.get(e.sourceId)!.push(e.targetId);
    }
    if(!adjacency.has(sourceId)) adjacency.set(sourceId, []);
    adjacency.get(sourceId)!.push(targetId);
    // DFS from target to see if we reach source
    const visited = new Set<string>();
    const stack = [targetId];
    let cyc = false;
    while(stack.length){
      const cur = stack.pop()!;
      if(cur === sourceId){ cyc = true; break; }
      if(visited.has(cur)) continue;
      visited.add(cur);
      const next = adjacency.get(cur) || [];
      for(const n of next) stack.push(n);
    }
    if(cyc){
      return res.status(409).json({ error: { code: 'cycle', message: 'Edge would create a cycle' } });
    }
    const edge: GroupEdge = { id: 'ge_'+nanoid(6), sourceId, targetId, kind };
    edges.push(edge);
    await fs.writeFile(edgePath, JSON.stringify(edges, null, 2));
    return res.status(201).json({ edge });
  }
  return methodNotAllowed(res);
}
