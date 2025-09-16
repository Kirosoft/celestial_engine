import { describe, it, expect } from 'vitest';
import { appendEntry, trimHistory, ChatEntry } from '../lib/chatHistory';

describe('chatHistory util', () => {
  it('appends entry and assigns id/ts', () => {
    const next = appendEntry([], { role: 'user', content: 'hello' }, 100);
    expect(next.length).toBe(1);
    expect(next[0].id).toBeTruthy();
    expect(next[0].ts).toBeGreaterThan(0);
  });
  it('trims to maxEntries when appending', () => {
    let hist: ChatEntry[] = [];
    for(let i=0;i<5;i++) hist = appendEntry(hist, { role:'user', content:String(i) }, 3);
    expect(hist.length).toBe(3);
    expect(hist[0].content).toBe('2');
  });
  it('trimHistory slices oldest entries', () => {
    const hist: ChatEntry[] = Array.from({ length:5 }, (_,i)=> ({ id:String(i), role:'user', content:String(i), ts: i }));
    const trimmed = trimHistory(hist, 2);
    expect(trimmed.map(h=>h.content)).toEqual(['3','4']);
  });
});
