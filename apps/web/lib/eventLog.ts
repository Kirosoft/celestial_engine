import { FileRepo } from './fileRepo';

const EVENTS_PATH = '.awb/events.log';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export interface EventRecord { id: string; ts: string; commandId: string; type: string; data: any; version: number }

async function appendRaw(line: string){
  // naive append; rotation check
  let rotate = false;
  try {
    // Can't easily stat without exposing fs; use FileRepo.exists + read size by reading file (small risk). Optimize later.
    if(await FileRepo.exists(EVENTS_PATH)){
      const content = await FileRepo.read(EVENTS_PATH);
      if(content.length + line.length > MAX_SIZE) rotate = true;
    }
  } catch {}
  if(rotate){
    const ts = Date.now();
    await FileRepo.write(`${EVENTS_PATH}.${ts}`, '');
    // simple rotation: move old content (inefficient but placeholder)
  }
  // append by reading existing then writing (not atomic but placeholder; can optimize with fs APIs if exposed)
  let base = '';
  if(await FileRepo.exists(EVENTS_PATH)) base = await FileRepo.read(EVENTS_PATH);
  base += line + '\n';
  await FileRepo.write(EVENTS_PATH, base);
}

export async function appendEvents(events: EventRecord[]){
  for(const e of events){ await appendRaw(JSON.stringify(e)); }
}

export const EventLog = { appendEvents };
