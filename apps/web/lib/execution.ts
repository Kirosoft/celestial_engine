import { nanoid } from 'nanoid';
import { getNode } from './nodeRepo';

// Minimal shape reference (expand if needed)
interface NodeFile { id: string; type: string; props?: Record<string, any>; }

export interface EdgePayload { edgeId: string; sourceNodeId: string; payload: any; ts: number; port: string }
export interface ExecutionContext {
  nodeId: string;
  nodeType: string;
  props: Record<string, any>;
  inputs: Record<string, EdgePayload[]>;
  latest: Record<string, any>;
  emit: (port: string, value: any) => void;
  logger: Console;
  runId: string;
  runChain: string[];
  mode: 'runtime' | 'design';
}
export interface ExecuteResult {
  outputs?: Record<string, any>;
  patchProps?: Record<string, any>;
  diagnostics?: Array<{ level: 'info'|'warn'|'error'; message: string; data?: any }>;
  error?: string;
  durationMs?: number;
}
export type ExecutorFn = (ctx: ExecutionContext) => Promise<ExecuteResult> | ExecuteResult;

const registry = new Map<string, ExecutorFn>();

export function registerExecutor(nodeType: string, fn: ExecutorFn){
  registry.set(nodeType, fn);
}
export function getExecutor(nodeType: string): ExecutorFn {
  return registry.get(nodeType) || (async () => ({ diagnostics: [{ level: 'warn', message: `No executor for ${nodeType}` }] }));
}

// In-memory input buffers (MVP). nodeId -> port -> payload list
const inputBuffers: Record<string, Record<string, EdgePayload[]>> = {};
export function appendInput(targetNodeId: string, port: string, payload: any, meta: { edgeId: string; sourceNodeId: string; ts?: number }){
  inputBuffers[targetNodeId] = inputBuffers[targetNodeId] || {};
  inputBuffers[targetNodeId][port] = inputBuffers[targetNodeId][port] || [];
  inputBuffers[targetNodeId][port].push({ edgeId: meta.edgeId, sourceNodeId: meta.sourceNodeId, payload, ts: meta.ts || Date.now(), port });
}
export function getInputs(nodeId: string){
  return inputBuffers[nodeId] || {};
}

export async function runNode(nodeId: string, options: { mode?: 'runtime'|'design'; runChain?: string[] } = {}){
  const runId = 'run_'+nanoid(8);
  const node = await getNode(nodeId);
  const nodeType = (node as any).type;
  const props = (node as any).props || {};
  const inputs = getInputs(nodeId);
  const latest: Record<string, any> = {};
  for(const [port, arr] of Object.entries(inputs)){
    if(arr.length) latest[port] = arr[arr.length - 1].payload;
  }
  const runChain = [...(options.runChain || []), nodeId];
  if(runChain.length > 5 || runChain.filter(id=> id===nodeId).length > 2){
    return { runId, error: 'run_chain_depth_exceeded', diagnostics: [{ level:'error', message:'Run chain depth or repetition limit exceeded' }] };
  }
  const emissions: { port: string; value: any }[] = [];
  const ctx: ExecutionContext = {
    nodeId, nodeType, props, inputs, latest,
    emit: (port, value) => { emissions.push({ port, value }); },
    logger: console,
    runId,
    runChain,
    mode: options.mode || 'runtime'
  };
  const executor = getExecutor(nodeType);
  const started = Date.now();
  let result: ExecuteResult;
  try { result = await executor(ctx); }
  catch(e:any){
    return { runId, error: e?.message || 'execute_error', diagnostics:[{ level:'error', message:'Executor threw', data: { stack: e?.stack } }] };
  }
  const durationMs = Date.now() - started;
  // Merge emissions and result.outputs
  if(result.outputs){
    for(const [port, value] of Object.entries(result.outputs)){
      emissions.push({ port, value });
    }
  }
  return { runId, emissions, ...result, durationMs };
}

export function getInputBuffers(){ return inputBuffers; }

// Emission helper: propagate value to targets via edges
import { listNodes, updateNode } from './nodeRepo';
import { appendLogEntry } from './logHistory';

export async function emitFrom(nodeId: string, port: string, value: any){
  const all = await listNodes();
  const source = all.find(n=> (n as any).id === nodeId);
  if(!source) return;
  const edges = (source as any).edges?.out || [];
  for(const e of edges){
    // For MVP we ignore port mapping complexity; assume single logical output port.
    appendInput(e.targetId, port, value, { edgeId: e.id, sourceNodeId: nodeId });
    // If target is ChatNode and source is LLM, append assistant history entry
    const target = all.find(n=> (n as any).id === e.targetId);
    if(target && (target as any).type === 'ChatNode' && (source as any).type === 'LLM'){
      const props = (target as any).props || { history: [] };
      const history = props.history || [];
      history.push({ id: 'h_'+nanoid(6), role: 'assistant', content: String(value), ts: Date.now() });
      (target as any).props = { ...props, history };
      await updateNode((target as any).id, { props: (target as any).props });
    }
    // If target is LogNode append log entry respecting maxEntries & filters
    if(target && (target as any).type === 'LogNode'){
      const t: any = target;
      const props = t.props || { history: [] };
      const maxEntries = props.maxEntries || 300;
      const filters: string[] = props.filterIncludes || [];
      const history = props.history || [];
      const nextHistory = appendLogEntry(history, value, { sourceId: nodeId, port }, { maxEntries, filterIncludes: filters });
      if(nextHistory !== history){
        t.props = { ...props, history: nextHistory };
        await updateNode(t.id, { props: t.props });
      }
    }
  }
}

// Register LLM executor stub
registerExecutor('LLM', async (ctx) => {
  const tmpl: string = ctx.props.promptTemplate || '{message}';
  const message = (ctx.latest && (ctx.latest as any).message) || '';
  const rendered = tmpl.replace('{message}', String(message));
  // Fake assistant output (echo)
  const assistant = `Assistant: ${rendered}`;
  ctx.emit('output', assistant);
  return { outputs: { output: assistant } };
});
