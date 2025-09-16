import { describe, it, expect } from 'vitest';
import { appendLogEntry, classifyPayload, truncate } from '../lib/logHistory';

describe('logHistory utility', () => {
  it('classifies string payload', () => {
    const c = classifyPayload('hello');
    expect(c.kind).toBe('text');
    expect(c.preview).toBe('hello');
  });

  it('classifies object payload and stores raw below size threshold', () => {
    const obj = { a: 1 };
    const history = appendLogEntry([], obj, { sourceId: 'A', port: 'p' }, { maxEntries: 10 });
    expect(history.length).toBe(1);
    expect(history[0].kind).toBe('json');
    expect(history[0].raw).toEqual(obj);
  });

  it('truncates long previews', () => {
    const long = 'x'.repeat(200);
    const history = appendLogEntry([], long, {}, { previewMax: 50 });
    expect(history[0].preview.length).toBe(50); // includes ellipsis char
  });

  it('applies filters (non-matching skipped)', () => {
    const h1 = appendLogEntry([], 'alpha', {}, { filterIncludes: ['beta'] });
    expect(h1.length).toBe(0);
    const h2 = appendLogEntry([], 'alpha Beta', {}, { filterIncludes: ['beta'] });
    expect(h2.length).toBe(1);
  });

  it('trims to maxEntries', () => {
    let history: any[] = [];
    for(let i=0;i<15;i++){
      history = appendLogEntry(history, 'm'+i, {}, { maxEntries: 10 });
    }
    expect(history.length).toBe(10);
    expect(history[0].preview).toBe('m5');
    expect(history[9].preview).toBe('m14');
  });
});
