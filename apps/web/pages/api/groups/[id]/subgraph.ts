import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, sendError } from '../../../../lib/apiErrors';
import { FileRepo } from '../../../../lib/fileRepo';
import { GroupRepo } from '../../../../lib/groupRepo';
import { promises as fs } from 'fs';
import { resolve } from 'path';

// GET /api/groups/:id/subgraph
// Returns the subgraph (nodes + edges) for a group. Includes proxy nodes
// plus any real nodes created inside the group via /api/groups/:id/nodes and any subgroup edges.
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'GET'){
      const { id } = req.query as { id: string };
      // Existence check: group node persisted at nodes/<id>.json
      const exists = await GroupRepo.existsGroup(id);
      if(!exists){
        return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${id}` } });
      }
      const nodes = await GroupRepo.listGroupNodes(id);
      // Load edges from group edge file if it exists
      let edges: any[] = [];
      try {
        const root = FileRepo.safeJoin(GroupRepo.groupRoot(id));
        const edgePath = resolve(root, 'edges.json');
        try { await fs.access(edgePath); edges = JSON.parse(await fs.readFile(edgePath, 'utf8')); } catch { /* no edges yet */ }
      } catch {/* ignore path issues */ }
      return res.status(200).json({ nodes, edges });
    }
    return methodNotAllowed(res);
  } catch(e){
    return sendError(res, e);
  }
}
