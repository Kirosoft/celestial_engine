import { FileRepo } from './fileRepo';
import { readJson } from './fileRepo';
import { NotFoundError } from './errors';

let cache: Record<string, any> = {};
let loaded = false;

async function loadAll(){
  const files = await FileRepo.list('schemas/nodes/*.schema.json');
  cache = {};
  for(const f of files){
    try {
      const schema = await readJson<any>(f);
      const type = schema.title || schema.type || f.replace(/.*\/(.*?)\.schema\.json$/, '$1');
      cache[type] = schema;
    } catch(e){
      console.error('[schemaLoader] failed to load', f, e);
    }
  }
  loaded = true;
}

export async function getNodeTypeSchema(type: string){
  if(!loaded) await loadAll();
  const s = cache[type];
  if(!s) throw new NotFoundError('schema', type);
  return s;
}

export async function listNodeTypeSchemas(){
  if(!loaded) await loadAll();
  return Object.values(cache);
}

export async function reloadSchemas(){
  loaded = false; cache = {}; await loadAll();
}
