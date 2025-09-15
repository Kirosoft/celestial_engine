import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, sendError } from '../../../../lib/apiErrors';
import { FileRepo } from '../../../../lib/fileRepo';
import { GroupRepo } from '../../../../lib/groupRepo';

// GET /api/groups/:id/subgraph
// Returns the subgraph (nodes + edges) for a group. Currently includes proxy nodes
// plus any real nodes created inside the group via /api/groups/:id/nodes. Edges array
// remains empty until intra-group edge support is added.
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method === 'GET'){
      const { id } = req.query as { id: string };
      // Existence check: group node persisted at nodes/<id>.json
      const exists = await FileRepo.exists(`nodes/${id}.json`);
      if(!exists){
        return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${id}` } });
      }
      const nodes = await GroupRepo.listGroupNodes(id);
      // Placeholder: edges will be loaded once intra-group edges are supported.
      return res.status(200).json({ nodes, edges: [] });
    }
    return methodNotAllowed(res);
  } catch(e){
    return sendError(res, e);
  }
}
