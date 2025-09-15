import { nanoid } from 'nanoid';
import { FileRepo } from './fileRepo';
import { IndexRepo as RootIndexRepo } from './indexRepo';
import { assertValidNode } from './validator';

// Group subgraph lives under groups/<groupId>/

function groupRoot(id: string){
  return `groups/${id}`;
}

function groupNodesDir(id: string){
  return `${groupRoot(id)}/nodes`;
}

function groupIndexPath(id: string){
  return `${groupRoot(id)}/.awb/index.json`; // parallel to root index
}

async function ensureDir(path: string){
  // Use FileRepo.write with empty file trick to ensure parent, then delete
  // Simpler: writeJson on a temp stub and delete; or rely on mkdir via writeJson below.
  await FileRepo.write(path + '/.keep', '');
}

export interface GroupProxyNode {
  id: string; type: string; name: string; position?: { x: number; y: number }; props?: any; edges?: { out: any[] };
}

export interface InitGroupOptions { id?: string; name?: string; inputs?: string[]; outputs?: string[] }

export async function initGroup(opts: InitGroupOptions = {}){
  const id = opts.id || `Group-${nanoid(6)}`;
  const inputs = opts.inputs || [];
  const outputs = opts.outputs || [];
  // Create directory structure by writing index if absent
  const indexPath = groupIndexPath(id);
  const exists = await FileRepo.exists(indexPath);
  if(!exists){
    const idx = { version: 0, generatedAt: new Date().toISOString(), nodes: [] as any[] };
    await FileRepo.writeJson(indexPath, idx);
  }
  // Create proxy nodes for inputs/outputs (persist to simplify listing). Id pattern: __in_<name> / __out_<name>
  for(const p of inputs){
    await createProxyNode(id, 'input', p);
  }
  for(const p of outputs){
    await createProxyNode(id, 'output', p);
  }
  return { id, inputs, outputs };
}

function proxyNodeId(kind: 'input'|'output', port: string){
  return `__${kind}_${port}`;
}

async function createProxyNode(groupId: string, kind: 'input'|'output', port: string){
  const node = {
    id: proxyNodeId(kind, port),
    type: kind === 'input' ? 'GroupInputProxy' : 'GroupOutputProxy',
    name: port,
    position: { x: kind==='input'?40:400, y: 60 },
    props: { port, groupId, kind },
    edges: { out: [] }
  };
  // No schema yet for proxies; skip validation or add conditional when schema provided
  const path = `${groupNodesDir(groupId)}/${node.id}.json`;
  await FileRepo.writeJson(path, node);
  return node;
}

async function deleteProxyNode(groupId: string, kind: 'input'|'output', port: string){
  const id = proxyNodeId(kind, port);
  const path = `${groupNodesDir(groupId)}/${id}.json`;
  if(await FileRepo.exists(path)) await FileRepo.delete(path);
}

export async function listGroupNodes(groupId: string){
  const files = await FileRepo.list(`${groupNodesDir(groupId)}/*.json`);
  const nodes: any[] = [];
  for(const f of files){
    try { nodes.push(await FileRepo.readJson<any>(f)); } catch(e){ console.warn('[GroupRepo] failed to read', f, e); }
  }
  return nodes;
}

export const GroupRepo = { initGroup, listGroupNodes, groupRoot, groupNodesDir, groupIndexPath, createProxyNode, deleteProxyNode };
