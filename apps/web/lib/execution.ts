import { nanoid } from 'nanoid';
import { getNode } from './nodeRepo';
import { readSettings } from './systemSettingsRepo';

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
  // Persist patchProps if provided
  if(result && result.patchProps){
    const cleaned: Record<string, any> = { ...props, ...result.patchProps };
    for(const k of Object.keys(cleaned)) if(cleaned[k] === undefined) delete cleaned[k];
    try { await updateNode(nodeId, { props: cleaned }); } catch(err:any){
      console.error('[exec] failed to persist patchProps', { nodeId, error: err?.message });
    }
  }
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
import { scanDirectory, readFileSafe, parsePatternList } from './fileScanner';

export async function emitFrom(nodeId: string, port: string, value: any){
  console.debug('[exec] emitFrom start', { nodeId, port, valuePreview: typeof value === 'string' ? value.slice(0,60) : value });
  const all = await listNodes();
  const source = all.find(n=> (n as any).id === nodeId);
  if(!source) return;
  const edges = (source as any).edges?.out || [];
  if(!edges.length){
    console.debug('[exec] no outgoing edges', { nodeId });
  }
  for(const e of edges){
    console.debug('[exec] propagating', { from: nodeId, to: e.targetId, edgeId: e.id, port });
    // For MVP we ignore port mapping complexity; assume single logical output port.
    appendInput(e.targetId, port, value, { edgeId: e.id, sourceNodeId: nodeId });
    // If target is ChatNode and source is LLM, append assistant history entry
    const target = all.find(n=> (n as any).id === e.targetId);
    if(target && (target as any).type === 'ChatNode' && (source as any).type === 'LLM'){
      console.debug('[exec] appending assistant history entry to ChatNode', { chatNodeId: e.targetId });
      const props = (target as any).props || { history: [] };
      const history = props.history || [];
      history.push({ id: 'h_'+nanoid(6), role: 'assistant', content: String(value), ts: Date.now() });
      (target as any).props = { ...props, history };
      await updateNode((target as any).id, { props: (target as any).props });
    }
    // If target is LogNode append log entry respecting maxEntries & filters
    if(target && (target as any).type === 'LogNode'){
      console.debug('[exec] logging emission to LogNode', { logNodeId: e.targetId });
      const t: any = target;
      const props = t.props || { history: [] };
      const maxEntries = props.maxEntries || 300;
      const filters: string[] = props.filterIncludes || [];
      const history = props.history || [];
      const nextHistory = appendLogEntry(history, value, { sourceId: nodeId, port }, { maxEntries, filterIncludes: filters });
      if(nextHistory !== history){
        console.debug('[exec] updating LogNode history', { logNodeId: t.id, newSize: nextHistory.length });
        t.props = { ...props, history: nextHistory };
        await updateNode(t.id, { props: t.props });
      }
    }
    // Auto-execute target if it has an executor (and is not purely passive like LogNode or ChatNode receiving assistant entries)
    if(target && !['LogNode'].includes((target as any).type)){
      const targetType = (target as any).type;
      const hasExecutor = registry.has(targetType);
      if(hasExecutor){
        console.debug('[exec] auto-run target executor', { targetId: (target as any).id, targetType });
        try {
          const run = await runNode((target as any).id, { runChain: [nodeId] });
          if('emissions' in run && Array.isArray((run as any).emissions) && (run as any).emissions.length){
            for(const em of (run as any).emissions){
              console.debug('[exec] cascading emission', { from: (target as any).id, port: em.port, preview: typeof em.value === 'string' ? em.value.slice(0,60) : em.value });
              // Recursive propagation (depth limited by runNode guard)
              await emitFrom((target as any).id, em.port, em.value);
            }
          }
        } catch(err:any){
          console.error('[exec] auto-run error', { targetId: (target as any).id, error: err?.message });
        }
      }
    }
  }
}

// Register LLM executor stub
registerExecutor('LLM', async (ctx) => {
  console.debug('[exec] LLM executor start', { nodeId: ctx.nodeId, latestKeys: Object.keys(ctx.latest), inputs: Object.keys(ctx.inputs) });
  // Load global system settings (masked apiKey not needed here)
  let settings;
  try { settings = await readSettings({ reveal: true }); } catch { settings = null; }
  const globalModel = settings?.llm?.defaultModel || 'gpt-3.5-turbo';
  const streaming = settings?.llm?.useStreaming || false;
  const timeoutMs = settings?.llm?.timeoutMs || 60000;
  const effectiveModel = ctx.props.model || globalModel;
  const tmpl: string = ctx.props.promptTemplate || '{message}';
  const message = (ctx.latest && (ctx.latest as any).message) || '';
  const rendered = tmpl.replace('{message}', String(message));
  const assistant = `Assistant(${effectiveModel}${streaming ? ',stream' : ''}): ${rendered}`;
  console.debug('[exec] LLM executor emitting', { nodeId: ctx.nodeId, model: effectiveModel, streaming, timeoutMs, assistantPreview: assistant.slice(0,60) });
  return { outputs: { output: assistant } };
});

// FileReaderNode executor
registerExecutor('FileReaderNode', async (ctx) => {
  const repoRoot = process.env.REPO_ROOT || process.cwd();
  const action: string | undefined = ctx.props.action; // transient trigger, cleared after handling
  const mode: 'single'|'directory' = ctx.props.mode || 'single';
  const emitContent: boolean = !!ctx.props.emitContent;
  const maxFileSize: number = typeof ctx.props.maxFileSizeBytes === 'number' ? ctx.props.maxFileSizeBytes : 512000;
  const encodedAs: 'text'|'base64'|'none' = ctx.props.encodedAs || 'text';
  let patch: Record<string, any> = {}; // accumulate prop mutations
  const diagnostics: any[] = [];

  function clearAction(){ if(action) patch.action = undefined; }

  if(!action){
    return { diagnostics: [{ level:'info', message:'no_action' }] };
  }

  try {
    if((action === 'read' || action === 'sendNext') && mode === 'single'){
      const fp = ctx.props.filePath;
      if(!fp){
        diagnostics.push({ level:'error', message:'filePath_missing' });
      } else {
        const r = await readFileSafe(repoRoot, fp);
        if(!r.ok){
          diagnostics.push({ level:'error', message:'read_failed', data: r.error });
          patch.lastError = r.error;
        } else {
          patch.lastError = null;
          const size = r.stat?.size || r.content?.length || 0;
            let contentStr: string | undefined;
            let contentEncoding: 'utf-8' | 'base64' | undefined;
            if(emitContent && r.content){
              if(size <= maxFileSize){
                if(encodedAs === 'text'){
                  contentStr = r.content.toString('utf-8');
                  contentEncoding = 'utf-8';
                } else if(encodedAs === 'base64'){
                  contentStr = r.content.toString('base64');
                  contentEncoding = 'base64';
                }
              }
            }
          const payload = {
            path: fp,
            size,
            modifiedMs: r.stat?.mtimeMs,
            contentEncoding,
            content: contentStr
          };
          return { outputs: { file: payload }, patchProps: { ...patch } };
        }
      }
    }
    else if(action === 'scan' && mode === 'directory'){
      const dp = ctx.props.dirPath;
      if(!dp){ diagnostics.push({ level:'error', message:'dirPath_missing' }); }
      else {
        const patternsRaw = ctx.props.includePatterns || '*';
        const { files, error } = await scanDirectory({ dirPath: dp, includePatterns: patternsRaw, repoRoot });
        if(error){
          diagnostics.push({ level:'error', message:'scan_failed', data: error });
          patch.lastError = error;
        } else {
          patch.scannedFiles = files.map(f=> f.relativePath);
          patch.cursorIndex = -1;
          patch.lastError = null;
        }
      }
    }
    else if((action === 'next' || action === 'sendNext') && mode === 'directory'){
      const scanned: string[] = ctx.props.scannedFiles || [];
      let cursor: number = typeof ctx.props.cursorIndex === 'number' ? ctx.props.cursorIndex : -1;
      if(!scanned.length){
        diagnostics.push({ level:'warn', message:'empty_scanned_files' });
      } else if(cursor + 1 >= scanned.length){
        // wrap-around for sendNext; plain next will just report end
        if(action === 'sendNext'){
          cursor = 0;
          patch.cursorIndex = cursor;
          const rel = scanned[cursor];
          const full = ctx.props.dirPath ? `${ctx.props.dirPath}/${rel}`.replace(/\\/g,'/') : rel;
          const r = await readFileSafe(repoRoot, full);
          if(!r.ok){
            diagnostics.push({ level:'error', message:'read_failed', data: r.error });
            patch.lastError = r.error;
          } else {
            patch.lastError = null;
            const size = r.stat?.size || r.content?.length || 0;
            let contentStr: string | undefined; let contentEncoding: 'utf-8' | 'base64' | undefined;
            if(emitContent && r.content && size <= maxFileSize){
              if(encodedAs === 'text'){ contentStr = r.content.toString('utf-8'); contentEncoding = 'utf-8'; }
              else if(encodedAs === 'base64'){ contentStr = r.content.toString('base64'); contentEncoding = 'base64'; }
            }
            const payload = { path: full, size, modifiedMs: r.stat?.mtimeMs, index: cursor, total: scanned.length, contentEncoding, content: contentStr, wrapped: true };
            clearAction();
            return { outputs: { file: payload }, patchProps: { ...patch } };
          }
        } else {
          diagnostics.push({ level:'info', message:'end_of_list' });
        }
      } else {
        cursor += 1;
        patch.cursorIndex = cursor;
        const rel = scanned[cursor];
        const full = ctx.props.dirPath ? `${ctx.props.dirPath}/${rel}`.replace(/\\/g,'/') : rel;
        const r = await readFileSafe(repoRoot, full);
        if(!r.ok){
          diagnostics.push({ level:'error', message:'read_failed', data: r.error });
          patch.lastError = r.error;
        } else {
          patch.lastError = null;
          const size = r.stat?.size || r.content?.length || 0;
          let contentStr: string | undefined; let contentEncoding: 'utf-8' | 'base64' | undefined;
          if(emitContent && r.content && size <= maxFileSize){
            if(encodedAs === 'text'){ contentStr = r.content.toString('utf-8'); contentEncoding = 'utf-8'; }
            else if(encodedAs === 'base64'){ contentStr = r.content.toString('base64'); contentEncoding = 'base64'; }
          }
          const payload = {
            path: full,
            size,
            modifiedMs: r.stat?.mtimeMs,
            index: cursor,
            total: scanned.length,
            contentEncoding,
            content: contentStr
          };
          clearAction();
          return { outputs: { file: payload }, patchProps: { ...patch } };
        }
      }
    }
    else if(action === 'reset' && mode === 'directory'){
      patch.scannedFiles = [];
      patch.cursorIndex = -1;
      patch.lastError = null;
    }
    else {
      diagnostics.push({ level:'warn', message:'unsupported_action_or_mode', data: { action, mode } });
    }
  } finally {
    clearAction();
  }
  return { diagnostics, patchProps: { ...patch } };
});
