import { createHash } from 'crypto';
import { FileRepo } from './fileRepo';
import { NodeFile } from './nodeRepo';

const INDEX_PATH = '.awb/index.json';

interface IndexNodeEntry { id: string; type: string; name: string; propsHash: string; mtime: string }
interface GraphIndex { version: number; generatedAt: string; nodes: IndexNodeEntry[] }

async function loadIndex(): Promise<GraphIndex> {
  if(!(await FileRepo.exists(INDEX_PATH))) {
    const fresh: GraphIndex = { version: 0, generatedAt: new Date().toISOString(), nodes: [] };
    await FileRepo.writeJson(INDEX_PATH, fresh);
    return fresh;
  }
  try {
    return await FileRepo.readJson<GraphIndex>(INDEX_PATH);
  } catch(err){
    console.error('[IndexRepo] Failed to parse index.json – attempting repair', err);
    // Backup corrupt file
    try {
      const raw = await FileRepo.read(INDEX_PATH);
      await FileRepo.write(`.awb/index.corrupt-${Date.now()}.json`, raw);
    } catch(e){ console.warn('[IndexRepo] Could not backup corrupt index', e); }
    // Rebuild from existing node files
    try {
      const nodeFiles = await FileRepo.list('nodes/*.json');
      const nodes: IndexNodeEntry[] = [];
      for(const f of nodeFiles){
        try {
          const nf = await FileRepo.readJson<NodeFile>(f);
          nodes.push({ id: nf.id, type: nf.type, name: nf.name, propsHash: hashProps(nf.props), mtime: new Date().toISOString() });
        } catch(e){ console.warn('[IndexRepo] Skipping node during rebuild', f, e); }
      }
      const rebuilt: GraphIndex = { version: nodes.length, generatedAt: new Date().toISOString(), nodes };
      await FileRepo.writeJson(INDEX_PATH, rebuilt);
      console.log('[IndexRepo] Rebuilt index.json with', nodes.length, 'nodes');
      return rebuilt;
    } catch(e){
      console.error('[IndexRepo] Rebuild failed, writing empty index', e);
      const empty: GraphIndex = { version: 0, generatedAt: new Date().toISOString(), nodes: [] };
      await FileRepo.writeJson(INDEX_PATH, empty);
      return empty;
    }
  }
}

function hashProps(props: any): string {
  const json = JSON.stringify(props||{});
  return createHash('sha1').update(json).digest('hex');
}

async function writeIndex(idx: GraphIndex){
  idx.generatedAt = new Date().toISOString();
  await FileRepo.writeJson(INDEX_PATH, idx);
}

export async function addOrUpdateNodeIndex(node: NodeFile){
  const idx = await loadIndex();
  const h = hashProps(node.props);
  const existing = idx.nodes.find(n=>n.id===node.id);
  if(existing){
    existing.name = node.name;
    existing.type = node.type;
    existing.propsHash = h;
    existing.mtime = new Date().toISOString();
  } else {
    idx.nodes.push({ id: node.id, type: node.type, name: node.name, propsHash: h, mtime: new Date().toISOString() });
  }
  idx.version++;
  await writeIndex(idx);
}

export async function removeNodeFromIndex(id: string){
  const idx = await loadIndex();
  const before = idx.nodes.length;
  idx.nodes = idx.nodes.filter(n=>n.id!==id);
  if(idx.nodes.length !== before){ idx.version++; await writeIndex(idx); }
}

export async function renameNodeInIndex(oldId: string, newId: string){
  const idx = await loadIndex();
  const entry = idx.nodes.find(n=>n.id===oldId);
  if(entry){ entry.id = newId; idx.version++; await writeIndex(idx); }
}

export async function listIndexNodes(){
  const idx = await loadIndex();
  return idx.nodes;
}

export async function rebuildIndex(allNodes: NodeFile[]){
  const idx = { version: 0, generatedAt: new Date().toISOString(), nodes: [] as IndexNodeEntry[] };
  for(const n of allNodes){
    idx.nodes.push({ id: n.id, type: n.type, name: n.name, propsHash: hashProps(n.props), mtime: new Date().toISOString() });
  }
  idx.version = allNodes.length;
  await writeIndex(idx);
  return idx;
}

export const IndexRepo = { addOrUpdateNodeIndex, removeNodeFromIndex, renameNodeInIndex, listIndexNodes, rebuildIndex };