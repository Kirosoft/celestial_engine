import { FileRepo } from './fileRepo';

const VERSION_PATH = '.awb/version.json';
const IDEMPOTENCY_PATH = '.awb/idempotency.json';

interface VersionState { version: number }
interface IdempotencyEntry { key: string; hash: string; ts: string }
interface IdempotencyState { entries: IdempotencyEntry[]; capacity: number }

async function loadVersion(): Promise<VersionState>{
  if(!(await FileRepo.exists(VERSION_PATH))){
    const v = { version: 0 }; await FileRepo.writeJson(VERSION_PATH, v); return v;
  }
  return FileRepo.readJson<VersionState>(VERSION_PATH);
}

async function writeVersion(v: VersionState){ await FileRepo.writeJson(VERSION_PATH, v); }

async function loadIdempotency(): Promise<IdempotencyState>{
  if(!(await FileRepo.exists(IDEMPOTENCY_PATH))){
    const st: IdempotencyState = { entries: [], capacity: 200 };
    await FileRepo.writeJson(IDEMPOTENCY_PATH, st);
    return st;
  }
  return FileRepo.readJson<IdempotencyState>(IDEMPOTENCY_PATH);
}

async function writeIdempotency(st: IdempotencyState){ await FileRepo.writeJson(IDEMPOTENCY_PATH, st); }

function hashJson(obj: any){ return require('crypto').createHash('sha1').update(JSON.stringify(obj||{})).digest('hex'); }

export async function getVersion(){ return (await loadVersion()).version; }

export async function bumpVersion(){ const v = await loadVersion(); v.version++; await writeVersion(v); return v.version; }

export async function checkIdempotency(key: string, payload: any){
  if(!key) return { duplicate: false } as const;
  const st = await loadIdempotency();
  const h = hashJson(payload);
  const existing = st.entries.find(e=>e.key===key);
  if(existing){
    return { duplicate: existing.hash === h, conflict: existing.hash !== h } as const;
  }
  // add entry
  st.entries.push({ key, hash: h, ts: new Date().toISOString() });
  if(st.entries.length > st.capacity) st.entries.splice(0, st.entries.length - st.capacity);
  await writeIdempotency(st);
  return { duplicate: false } as const;
}

export const VersionRepo = { getVersion, bumpVersion, checkIdempotency };
