import { FileRepo } from './fileRepo';
import { readJson } from './fileRepo';
import { NotFoundError, PathEscapeError } from './errors';

const debugEnabled = () => !!process.env.DEBUG_SCHEMAS;
function dbg(...args: any[]){ if(debugEnabled()) console.log('[schemaLoader]', ...args); }

let cache: Record<string, any> = {};
let loaded = false;

async function loadAll(){
  // Allow override/extension via SCHEMA_PATHS (comma-separated globs). Falls back to defaults.
  const env = (process.env.SCHEMA_PATHS || '').trim();
  const patterns = env ? env.split(',').map(s=>s.trim()).filter(Boolean) : [ 'schemas/nodes/*.schema.json' ];
  const seen = new Set<string>();
  const files: string[] = [];
  for(const p of patterns){
    // Avoid attempting parent traversal if it would escape repo root (FileRepo.safeJoin will throw)
    // Disallow parent traversal for consolidated single schema source
    if(p.startsWith('..')) continue;
    try {
      const list = await FileRepo.list(p);
      for(const f of list){ if(!seen.has(f)){ seen.add(f); files.push(f); } }
    } catch(err){ /* ignore missing pattern */ }
  }
  dbg('Attempting to load schemas from:', files);
  cache = {};
  for(const f of files){
    // Skip any file path that would escape repo root (quietly – this is expected in test temp roots)
    try {
      try { FileRepo.safeJoin(f); } catch(e){ if(e instanceof PathEscapeError) { continue; } else { throw e; } }
      dbg('Loading schema file:', f);
      const schema = await readJson<any>(f);
      const inferred = f.replace(/.*\/(.*?)\.schema\.json$/, '$1');
      const candidates = new Set<string>();
      if(schema.title) candidates.add(schema.title);
      if(schema.type && typeof schema.type === 'string') candidates.add(schema.type);
      if(schema.$id){
        // Allow lookup by $id terminal segment (before .schema.json) and by basename
        const idSeg = schema.$id.replace(/.*\/(.*?)\.schema\.json$/, '$1');
        if(idSeg) candidates.add(idSeg);
      }
      candidates.add(inferred);
      for(const key of candidates){
        if(!cache[key]) cache[key] = schema;
      }
    } catch(e){
      // Only log unexpected errors – suppress PathEscapeError (already handled above) & NotFound
      if(!(e instanceof PathEscapeError)){
        if(debugEnabled()) console.error('[schemaLoader] failed to load', f, e);
      }
    }
  }
  loaded = true;
}

export async function getNodeTypeSchema(type: string){
  if(!loaded) await loadAll();
  let s = cache[type];
  if(!s && type.startsWith('nodes/') && type.endsWith('.schema.json')){
    // fallback: strip prefix and suffix
    const stripped = type.replace(/^nodes\//,'').replace(/\.schema\.json$/, '');
    s = cache[stripped];
  }
  if(!s){
    if(debugEnabled()) console.error('[schemaLoader] schema not found:', type, '\nCurrent cache keys:', Object.keys(cache));
    throw new NotFoundError('schema', type);
  }
  return s;
}

export async function listNodeTypeSchemas(){
  if(!loaded) await loadAll();
  return Object.values(cache);
}

export async function reloadSchemas(){
  loaded = false; cache = {}; await loadAll();
}
