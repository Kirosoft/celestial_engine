import { EmissionEnvelope, NodeCapabilities } from '../types';
import { appendLogEntry } from '../../logHistory';

export interface MiddlewareContext {
  targetNodeId: string;
  targetType: string;
  getTargetProps?: () => Promise<Record<string, any>>;
  updateTargetProps?: (patch: Record<string, any>) => Promise<void>;
}

export interface MiddlewareResult { diagnostics?: Array<{ kind: string; level?: 'info'|'warn'|'error'; data?: any; ts: number }>; }

export async function logMiddleware(env: EmissionEnvelope, targetCaps: NodeCapabilities | undefined, ctx: MiddlewareContext): Promise<MiddlewareResult | void> {
  if(!targetCaps?.logsInputs) return;
  const props = ctx.getTargetProps ? await ctx.getTargetProps() : {};
  let history = Array.isArray(props.history) ? props.history.slice() : [];
  history = appendLogEntry(history, env.value, { sourceId: env.fromNodeId, port: env.fromPort }, { maxEntries: typeof props.maxEntries === 'number' ? props.maxEntries : 300 });
  if(ctx.updateTargetProps){ await ctx.updateTargetProps({ history }); }
  return { diagnostics: [{ kind: 'log_appended', level: 'info', data: { targetNodeId: ctx.targetNodeId }, ts: Date.now() }] };
}

function summarize(v: any){
  if(v == null) return String(v);
  if(typeof v === 'string') return v.slice(0,120);
  if(typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v).slice(0,160); } catch { return '[unserializable]'; }
}
