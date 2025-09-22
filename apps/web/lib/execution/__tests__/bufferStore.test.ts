import { describe, test, expect } from 'vitest';
import { InMemoryInputBufferStore } from '../bufferStore';
import { EmissionEnvelope } from '../types';

function env(v: any, i: number): EmissionEnvelope {
  return { id: 'e'+i, fromNodeId:'A', fromPort:'out', toNodeId:'B', toPort:'in', value: v, ts: Date.now() + i };
}

describe('InMemoryInputBufferStore', () => {
  test('append and latest', () => {
    const store = new InMemoryInputBufferStore();
    store.append('p', env(1,1));
    store.append('p', env(2,2));
    expect(store.getLatest('p')?.value).toBe(2);
  });
  test('window respects n', () => {
    const store = new InMemoryInputBufferStore();
    for(let i=0;i<5;i++) store.append('p', env(i,i));
    const w = store.window('p', 3).map(e=> e.value);
    expect(w).toEqual([2,3,4]);
  });
  test('since filters by timestamp', () => {
    const store = new InMemoryInputBufferStore();
    const base = Date.now();
    for(let i=0;i<5;i++) store.append('p', { id:'e'+i, fromNodeId:'A', fromPort:'out', toNodeId:'B', toPort:'in', value:i, ts: base + i });
    const s = store.since('p', base + 3).map(e=> e.value);
    expect(s).toEqual([3,4]);
  });
  test('eviction by maxPerPort', () => {
    const store = new InMemoryInputBufferStore({ maxPerPort: 3 });
    for(let i=0;i<6;i++) store.append('p', env(i,i));
    const all = store.getAll('p').map(e=> e.value);
    expect(all).toEqual([3,4,5]);
  });
  test('reduce accumulates', () => {
    const store = new InMemoryInputBufferStore();
    for(let i=1;i<=4;i++) store.append('p', env(i,i));
    const sum = store.reduce('p', (acc, e)=> acc + (e.value as number), 0);
    expect(sum).toBe(10);
  });
});
