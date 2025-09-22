import { EmissionEnvelope, NodeCapabilities } from '../types';

export interface MiddlewareContext {
  targetNodeId: string;
  targetType: string;
  // Placeholder for future injection (node props, repositories, etc.)
  getTargetProps?: () => Promise<Record<string, any>>;
  updateTargetProps?: (patch: Record<string, any>) => Promise<void>;
}

export interface MiddlewareResult {
  diagnostics?: Array<{ kind: string; level?: 'info'|'warn'|'error'; data?: any; ts: number }>;
}

export async function historyMiddleware(env: EmissionEnvelope, targetCaps: NodeCapabilities | undefined, ctx: MiddlewareContext): Promise<MiddlewareResult | void> {
  if(!targetCaps?.receivesHistory) return;
  // We only append assistant messages if source is flagged assistantEmitter OR meta role=assistant
  const role = env.meta?.role || (env.meta?.assistant ? 'assistant' : undefined);
  if(!role) return;

  const props = ctx.getTargetProps ? await ctx.getTargetProps() : {};
  const history = Array.isArray(props.history) ? props.history.slice() : [];
  history.push({ id: 'h_'+Math.random().toString(36).slice(2,8), role, content: String(env.value), ts: Date.now() });
  if(ctx.updateTargetProps){
    await ctx.updateTargetProps({ history });
  }
  return { diagnostics: [{ kind: 'history_appended', level: 'info', data: { targetNodeId: ctx.targetNodeId }, ts: Date.now() }] };
}
