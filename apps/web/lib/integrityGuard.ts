import { listNodes } from './nodeRepo';
import { FileRepo } from './fileRepo';
import { writeJson } from './fileRepo';

export interface IntegrityRepair { nodeId: string; removedEdgeIds: string[] }
export interface IntegrityReport { repaired: IntegrityRepair[]; totalRemoved: number }

export async function scanAndRepairDanglingEdges(): Promise<IntegrityReport>{
  const nodes = await listNodes();
  const idSet = new Set(nodes.map(n=>n.id));
  const repaired: IntegrityRepair[] = [];
  for(const n of nodes){
    if(!n.edges?.out?.length) continue;
    const before = n.edges.out.length;
    const keep = n.edges.out.filter(e=> idSet.has(e.targetId));
    if(keep.length !== before){
      const removedIds = n.edges.out.filter(e=> !idSet.has(e.targetId)).map(e=>e.id);
      n.edges.out = keep;
      await FileRepo.writeJson(`nodes/${n.id}.json`, n);
      repaired.push({ nodeId: n.id, removedEdgeIds: removedIds });
    }
  }
  return { repaired, totalRemoved: repaired.reduce((a,r)=> a + r.removedEdgeIds.length, 0) };
}
