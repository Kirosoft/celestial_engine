import { nanoid } from 'nanoid';
import { FileRepo } from './fileRepo';
import { IndexRepo } from './indexRepo';
import { assertValidNode } from './validator';
import { NotFoundError, ConflictError, CycleError } from './errors';

export interface Position { x: number; y: number }
export interface EdgeOut { id: string; targetId: string; kind: 'flow'|'data'; sourcePort?: string; targetPort?: string }
export interface NodeFile { id: string; type: string; name: string; position?: Position; props?: any; edges?: { out: EdgeOut[] } }

const nodesDir = 'nodes';

function nodePath(id: string){ return `${nodesDir}/${id}.json`; }

export async function createNode(type: string, name?: string, props: any = {}): Promise<NodeFile>{
  const id = `${type}-${nanoid(6)}`;
  const node: NodeFile = { id, type, name: name || id, props, position: { x: 120, y: 120 }, edges: { out: [] } };
  await assertValidNode(node);
  await FileRepo.writeJson(nodePath(id), node);
  await IndexRepo.addOrUpdateNodeIndex(node as any);
  return node;
}

export async function getNode(id: string): Promise<NodeFile>{
  if(!id.endsWith('.json')) id = id.replace(/\.json$/,'');
  const path = nodePath(id.replace(/\.json$/,''));
  const exists = await FileRepo.exists(path);
  if(!exists) throw new NotFoundError('node', id);
  return FileRepo.readJson<NodeFile>(path);
}

export async function listNodes(): Promise<NodeFile[]>{
  const files = await FileRepo.list(`${nodesDir}/*.json`);
  const out: NodeFile[] = [];
  for(const f of files){
    try { out.push(await FileRepo.readJson<NodeFile>(f)); } catch(e){ console.warn('[listNodes] failed', f, e); }
  }
  return out;
}

export async function updateNode(id: string, patch: Partial<NodeFile>): Promise<NodeFile>{
  const node = await getNode(id);
  Object.assign(node, patch, { id: node.id, type: node.type });
  await assertValidNode(node);
  await FileRepo.writeJson(nodePath(node.id), node);
  await IndexRepo.addOrUpdateNodeIndex(node as any);
  return node;
}

export async function updateNodePosition(id: string, position: Position){
  const node = await getNode(id);
  node.position = position;
  await FileRepo.writeJson(nodePath(node.id), node);
  await IndexRepo.addOrUpdateNodeIndex(node as any);
  return node;
}

export async function renameNode(oldId: string, newId: string){
  if(oldId === newId) return getNode(oldId);
  const existing = await FileRepo.exists(nodePath(newId));
  if(existing) throw new ConflictError(`Node id already exists: ${newId}`);
  const node = await getNode(oldId);
  node.id = newId; node.name = node.name === oldId ? newId : node.name;
  await FileRepo.writeJson(nodePath(newId), node);
  await FileRepo.delete(nodePath(oldId));
  await IndexRepo.removeNodeFromIndex(oldId);
  await IndexRepo.addOrUpdateNodeIndex(node as any);
  // Update edges referencing oldId as target
  const all = await listNodes();
  for(const n of all){
    let changed = false;
    n.edges?.out?.forEach(e=>{ if(e.targetId === oldId){ e.targetId = newId; changed = true; } });
    if(changed) await FileRepo.writeJson(nodePath(n.id), n);
  }
  return node;
}

export async function deleteNode(id: string){
  const path = nodePath(id);
  const exists = await FileRepo.exists(path);
  if(!exists) throw new NotFoundError('node', id);
  // Remove inbound references
  const all = await listNodes();
  for(const n of all){
    const before = n.edges?.out?.length || 0;
    if(before){
      n.edges!.out = n.edges!.out.filter(e=> e.targetId !== id);
      if(n.edges!.out.length !== before) await FileRepo.writeJson(nodePath(n.id), n);
    }
  }
  await FileRepo.delete(path);
  await IndexRepo.removeNodeFromIndex(id);
}

function detectCycle(source: NodeFile, targetId: string, all: NodeFile[]): boolean {
  // DFS from target to see if we can reach source
  const map = new Map(all.map(n=>[n.id, n] as const));
  const visited = new Set<string>();
  const stack = [targetId];
  while(stack.length){
    const cur = stack.pop()!;
    if(cur === source.id) return true;
    if(visited.has(cur)) continue;
    visited.add(cur);
    const n = map.get(cur);
    if(n?.edges?.out) for(const e of n.edges.out) stack.push(e.targetId);
  }
  return false;
}

export async function addEdge(sourceId: string, targetId: string, kind: 'flow'|'data'='flow'){
  if(sourceId === targetId) throw new CycleError('Self-loop not allowed');
  const source = await getNode(sourceId);
  const target = await getNode(targetId); // ensure exists
  const all = await listNodes();
  if(detectCycle(source, targetId, all)) throw new CycleError('Edge would create a cycle');
  source.edges = source.edges || { out: [] };
  const edge: EdgeOut = { id: 'e_'+nanoid(6), targetId, kind };
  source.edges.out.push(edge);
  await FileRepo.writeJson(nodePath(source.id), source);
  await IndexRepo.addOrUpdateNodeIndex(source as any);
  return edge;
}

export async function removeEdge(sourceId: string, edgeId: string){
  const source = await getNode(sourceId);
  const before = source.edges?.out?.length || 0;
  source.edges!.out = source.edges!.out.filter(e=> e.id !== edgeId);
  if(source.edges!.out.length === before) {
    console.warn('[removeEdge] edge not found', edgeId, 'in', sourceId, 'remaining', source.edges!.out.map(e=>e.id));
    throw new NotFoundError('edge', edgeId);
  }
  await FileRepo.writeJson(nodePath(source.id), source);
  await IndexRepo.addOrUpdateNodeIndex(source as any);
}

export async function updateEdge(sourceId: string, edgeId: string, patch: Partial<EdgeOut>){
  const source = await getNode(sourceId);
  const e = source.edges?.out?.find(e=> e.id === edgeId);
  if(!e) throw new NotFoundError('edge', edgeId);
  Object.assign(e, patch, { id: e.id });
  await FileRepo.writeJson(nodePath(source.id), source);
  await IndexRepo.addOrUpdateNodeIndex(source as any);
  return e;
}

export const NodeRepo = { createNode, getNode, listNodes, updateNode, updateNodePosition, renameNode, deleteNode, addEdge, removeEdge, updateEdge };
