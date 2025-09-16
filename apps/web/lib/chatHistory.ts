import { nanoid } from 'nanoid';

export interface ChatEntry { id: string; role: 'user'|'input'|'assistant'|'system'; content: string; ts: number }

export function appendEntry(history: ChatEntry[], entry: Omit<ChatEntry,'id'|'ts'> & { id?: string; ts?: number }, maxEntries = 200): ChatEntry[]{
  const full: ChatEntry = { id: entry.id || nanoid(8), ts: entry.ts || Date.now(), role: entry.role, content: entry.content };
  const next = [...history, full];
  if(next.length > maxEntries){
    return next.slice(next.length - maxEntries);
  }
  return next;
}

export function trimHistory(history: ChatEntry[], maxEntries = 200): ChatEntry[]{
  if(history.length <= maxEntries) return history;
  return history.slice(history.length - maxEntries);
}
