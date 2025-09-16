import { nanoid } from 'nanoid';

export interface LogEntry {
  id: string;
  ts: number;
  sourceId?: string;
  port?: string;
  kind?: string; // 'text' | 'json' | 'other'
  preview: string;
  raw?: any;
}

export interface AppendMeta {
  sourceId?: string;
  port?: string;
}

interface AppendOptions {
  maxEntries?: number;
  filterIncludes?: string[]; // case-insensitive substring filters
  largeObjectThreshold?: number; // serialized length threshold to store raw
  previewMax?: number; // truncate preview beyond this length
  rawMax?: number; // maximum serialized length to store raw
}

const DEFAULT_PREVIEW_MAX = 120;
const DEFAULT_RAW_MAX = 2000;

export function classifyPayload(payload: any): { kind: string; preview: string; raw?: any } {
  if (payload == null) {
    return { kind: 'other', preview: 'null' };
  }
  if (typeof payload === 'string') {
    const p = payload.trim();
    return { kind: 'text', preview: p };
  }
  if (typeof payload === 'object') {
    try {
      const json = JSON.stringify(payload);
      return { kind: 'json', preview: json, raw: payload };
    } catch {
      return { kind: 'other', preview: '[Unserializable Object]' };
    }
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return { kind: 'text', preview: String(payload) };
  }
  return { kind: 'other', preview: `[${typeof payload}]` };
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

export function appendLogEntry(
  history: LogEntry[],
  payload: any,
  meta: AppendMeta = {},
  options: AppendOptions = {}
): LogEntry[] {
  const maxEntries = options.maxEntries ?? 300;
  const filters = (options.filterIncludes || []).map(f => f.toLowerCase()).filter(Boolean);
  const previewMax = options.previewMax ?? DEFAULT_PREVIEW_MAX;
  const rawMax = options.rawMax ?? DEFAULT_RAW_MAX;

  const { kind, preview: rawPreview, raw } = classifyPayload(payload);
  const preview = truncate(rawPreview, previewMax);

  if (filters.length) {
    const lower = preview.toLowerCase();
    const match = filters.some(f => lower.includes(f));
    if (!match) {
      // Skip logging this entry
      return history;
    }
  }

  const entry: LogEntry = {
    id: nanoid(8),
    ts: Date.now(),
    sourceId: meta.sourceId,
    port: meta.port,
    kind,
    preview,
  };

  // Decide whether to keep raw
  if (raw !== undefined) {
    try {
      const len = JSON.stringify(raw).length;
      if (len < rawMax) {
        entry.raw = raw;
      }
    } catch {/* ignore */}
  }

  const next = [...history, entry];
  if (next.length > maxEntries) {
    return next.slice(next.length - maxEntries);
  }
  return next;
}

export function clearHistory(): LogEntry[] { return []; }
