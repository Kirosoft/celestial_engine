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
  const diagnostics: any[] = [];
  // Load optional system settings
  let settings; try { settings = await readSettings({ reveal: true }); } catch { settings = null; }
  const globalModel = settings?.llm?.defaultModel || 'gpt-3.5-turbo';
  const timeoutMs = settings?.llm?.timeoutMs || 60000;
  const streaming = ctx.props.streaming !== undefined ? !!ctx.props.streaming : (settings?.llm?.useStreaming || false);
  const llmSettings: any = settings?.llm || {};
  const provider: string = (ctx.props.provider || llmSettings.provider || 'openai');
  const effectiveModel: string = ctx.props.model || globalModel;
  const systemPrompt: string | undefined = ctx.props.system;
  const tmpl: string = ctx.props.promptTemplate || '{prompt}\n\n{context}';
  const autoDerive: boolean = ctx.props.autoDerivePromptFromFile !== undefined ? !!ctx.props.autoDerivePromptFromFile : true;
  // Collect raw latest inputs for template substitution (declare early for edge scan)
  const latestMap = ctx.latest || {};
  const inputVars: Array<{ port: string; var: string; kind?: string }> = Array.isArray(ctx.props.inputVars) ? ctx.props.inputVars : [];
  // Build additional var mappings from inbound data edges (edge varName -> payload) if not already covered
  try {
    const allNodes = await listNodes();
    const latestKeys = new Set(Object.keys(latestMap));
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    for(const n of allNodes){
      const outs = (n as any).edges?.out || [];
      for(const e of outs){
        if(e.targetId !== ctx.nodeId || e.kind !== 'data') continue;
        // Ensure a variable name
        const varName = e.varName || e.sourcePort || 'data_'+e.id.slice(-4);
        const sourceNode = allNodes.find(sn=> (sn as any).id === (n as any).id);
        let payloadKey: string | undefined = varName;
        let provided = false;
        if(sourceNode){
          const type = (sourceNode as any).type;
          const sProps = (sourceNode as any).props || {};
          try {
            if(type === 'FileReaderNode'){
              const fp = sProps.filePath;
              const emitContent = !!sProps.emitContent;
              if(fp){
                const templateHasVar = tmpl.includes(`{${varName}}`);
                if(!(autoDerive || templateHasVar)){
                  diagnostics.push({ level:'info', message:'cold_pull_skipped_unreferenced_file', data: { var: varName, path: fp } });
                } else {
                  const r = await readFileSafe(repoRoot, fp);
                  if(r.ok){
                    const size = r.stat?.size || r.content?.length || 0;
                    const content = emitContent && r.content ? r.content.toString('utf-8') : undefined;
                    latestMap[varName] = { path: fp, size, content, cold: true };
                    latestKeys.add(varName);
                    provided = true;
                    diagnostics.push({ level:'info', message:'cold_pull_file_success', data: { var: varName, path: fp, size, content: !!content, gated: !autoDerive && templateHasVar } });
                  } else {
                    diagnostics.push({ level:'warn', message:'cold_pull_file_failed', data: { var: varName, path: fp, error: r.error } });
                  }
                }
              } else {
                diagnostics.push({ level:'info', message:'cold_pull_no_file_path', data: { var: varName } });
              }
            } else if(type === 'ChatNode'){
              const hist = Array.isArray(sProps.history) ? sProps.history : [];
              const lastUser = [...hist].reverse().find(h=> h.role === 'user');
              if(lastUser){
                latestMap[varName] = { role: 'user', content: lastUser.content, cold: true };
                latestKeys.add(varName);
                provided = true;
                diagnostics.push({ level:'info', message:'cold_pull_chat_success', data: { var: varName, chars: lastUser.content?.length } });
              }
            } else if(type === 'LogNode'){
              const hist = Array.isArray(sProps.history) ? sProps.history : [];
              if(hist.length){
                const previews = hist.slice(-5).map((h: any)=> h.preview).join('\n');
                latestMap[varName] = { previews, cold: true };
                latestKeys.add(varName);
                provided = true;
                diagnostics.push({ level:'info', message:'cold_pull_log_success', data: { var: varName, entries: hist.length } });
              }
            } else {
              // Generic fallback: shallow props summary
              if(Object.keys(sProps).length){
                const summary = JSON.stringify(sProps).slice(0,4000);
                latestMap[varName] = { summary, cold: true };
                latestKeys.add(varName);
                provided = true;
                diagnostics.push({ level:'info', message:'cold_pull_generic_props', data: { var: varName, size: summary.length } });
              }
            }
          } catch(err:any){
            diagnostics.push({ level:'warn', message:'cold_pull_exception', data: { var: varName, error: err?.message } });
          }
        }
        // If nothing provided and we already had a buffered key under candidate names, fallback to that
        if(!provided){
          const fallbackKeys = [e.sourcePort, e.varName, varName, 'file', 'data', 'output'].filter(Boolean) as string[];
          const existing = fallbackKeys.find(k=> latestKeys.has(k));
          if(existing){ payloadKey = existing; provided = true; }
        }
        if(!provided) continue;
        if(!payloadKey) payloadKey = varName; // fallback safety
        const exists = inputVars.find(iv=> iv.var === varName);
        if(!exists && payloadKey){
          inputVars.push({ port: payloadKey, var: varName, kind: 'auto' });
          diagnostics.push({ level:'info', message:'implicit_var_mapping_added', data: { var: varName, port: payloadKey, generalized: true } });
        }
      }
    }
  } catch(err:any){
    diagnostics.push({ level:'warn', message:'inputVar_edge_scan_failed', data: { error: err?.message } });
  }
  // Build a base prompt (explicit message if any). Allow opt-out of implicit file->prompt derivation.
  // autoDerive already computed above
  let userMessage = (latestMap as any).message || '';
  const tmplMentionsPrompt = /\{prompt\}/.test(tmpl);
  if(!userMessage && autoDerive && tmplMentionsPrompt && ctx.latest && (ctx.latest as any).file){
    const f = (ctx.latest as any).file;
    if(f && typeof f === 'object'){
      if(f.content && typeof f.content === 'string'){
        userMessage = f.content.slice(0, 8000); // cap to avoid enormous prompts
        diagnostics.push({ level:'info', message:'derived_message_from_file_content', data: { bytes: f.content.length } });
      } else if(f.path){
        userMessage = `File path: ${f.path}`;
        diagnostics.push({ level:'info', message:'derived_message_from_file_path' });
      }
    }
  }
  if(!userMessage){
    diagnostics.push({ level:'warn', message:'empty_message_input', data: { latestKeys: Object.keys(ctx.latest) } });
  }
  // Aggregate contextual content (file contents etc.)
  const contextPieces: string[] = [];
  const tmplMentionsContext = /\{context\}/.test(tmpl);
  if(autoDerive && tmplMentionsContext && latestMap.file){
    const f = (latestMap as any).file;
    if(f && typeof f === 'object'){
      if(f.content && typeof f.content === 'string') contextPieces.push(f.content.slice(0, 10000));
      else if(f.path) contextPieces.push(`FILE:${f.path}`);
    }
  }
  // Process custom inputVars mapping
  const customValues: Record<string,string> = {};
  for(const mapping of inputVars){
    const { port, var: varName, kind = 'auto' } = mapping || {} as any;
    if(!port || !varName) continue;
    const val = (latestMap as any)[port];
    if(val === undefined) continue;
    let str = '';
    if(kind === 'raw') str = typeof val === 'string' ? val : JSON.stringify(val).slice(0,8000);
    else if(kind === 'fileContent' && val && typeof val === 'object' && val.content) str = String(val.content).slice(0,10000);
    else if(kind === 'filePath' && val && typeof val === 'object' && val.path) str = String(val.path);
    else if(kind === 'auto'){
      if(val && typeof val === 'object'){
        if('content' in val && typeof (val as any).content === 'string') str = (val as any).content.slice(0,8000);
        else if('path' in val) str = String((val as any).path);
        else str = JSON.stringify(val).slice(0,4000);
      } else str = String(val);
    }
    if(str) customValues[varName] = str;
  }
  // Build context (excluding explicit user message if it's file-derived duplication)
  const context = contextPieces.filter(Boolean).join('\n\n');
  // Primary replacement variables
  let rendered = tmpl;
  // Support both {prompt} and arbitrary direct placeholders like {message}. If a placeholder named {message}
  // exists and we have latestMap.message, treat it as prompt content for test determinism.
  const inferredMessage = userMessage || (typeof (latestMap as any).message === 'string' ? (latestMap as any).message : '');
  const replacements: Record<string,string> = { prompt: String(inferredMessage || ''), context: context };
  for(const [k,v] of Object.entries(customValues)) replacements[k] = v;
  // Add direct passthrough for simple scalar latestMap values (string/number/boolean) not already covered
  for(const [k,v] of Object.entries(latestMap)){
    if(!(k in replacements) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')){
      replacements[k] = String(v);
    }
  }
  rendered = rendered.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, g1)=> (g1 in replacements ? replacements[g1] : ''));
  const temperature: number = typeof ctx.props.temperature === 'number' ? ctx.props.temperature : (typeof llmSettings.temperature === 'number' ? llmSettings.temperature : 0.7);
  const maxOutputTokens: number | undefined = typeof ctx.props.maxOutputTokens === 'number'
    ? ctx.props.maxOutputTokens
    : (llmSettings.maxOutputTokens !== undefined ? llmSettings.maxOutputTokens : settings?.llm?.maxOutputTokens);
  const outputCharLimit: number | undefined = typeof (ctx.props as any).outputCharLimit === 'number'
    ? (ctx.props as any).outputCharLimit
    : (settings?.llm as any)?.outputCharLimit;

  // Detect Ollama usage either by explicit provider or recognizable local model name pattern
  const looksLikeOllama = provider === 'ollama' || /:|^llama|^mistral|^gemma|^qwen/i.test(effectiveModel);
  console.debug('[exec] LLM provider decision', { nodeId: ctx.nodeId, provider, effectiveModel, looksLikeOllama });
  if(looksLikeOllama){
  // Test environment short-circuit to avoid heavy model pulls
  if(process.env.NODE_ENV === 'test' || process.env.CE_TEST_MODE === '1'){
    // Deterministic synthetic output – keep only first line to avoid huge snapshot noise.
    const firstLine = rendered.split(/\r?\n/)[0].slice(0,160);
    const synthetic = `TEST_ASSISTANT(${effectiveModel}): ${firstLine}`;
    diagnostics.push({ level:'info', message:'ollama_test_short_circuit', data: { chars: firstLine.length } });
    return { outputs: { output: synthetic }, diagnostics };
  }
  const baseUrl: string = ctx.props.ollamaBaseUrl || llmSettings.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;
    const body = {
      model: effectiveModel,
      prompt: rendered,
      stream: false,
      options: { temperature }
    } as any;
    // Add a simple system prefix if provided
    if(systemPrompt){
      body.prompt = `System: ${systemPrompt}\nUser: ${rendered}`;
    }
    let controller: AbortController | undefined;
    let timeoutHandle: any;
    try {
      if(typeof AbortController !== 'undefined'){
        controller = new AbortController();
        timeoutHandle = setTimeout(()=> controller?.abort(), timeoutMs);
      }
      console.debug('[exec] LLM->Ollama request', { nodeId: ctx.nodeId, url, model: effectiveModel });
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), signal: controller?.signal });
      if(!res.ok){
        diagnostics.push({ level:'error', message:'ollama_request_failed', data: { status: res.status } });
        const fallback = `Assistant(${effectiveModel}): ${rendered}`;
        return { outputs: { output: fallback }, diagnostics };
      }
      const json: any = await res.json();
      let text: string = json?.response || json?.output || '';
      if(!text){
        diagnostics.push({ level:'warn', message:'ollama_empty_response' });
        text = '';
      }
      console.debug('[exec] LLM->Ollama response', { nodeId: ctx.nodeId, preview: text.slice(0,80) });
      // Truncate tokens client-side simple heuristic (split by whitespace)
      if(maxOutputTokens && maxOutputTokens > 0){
        const parts = text.split(/\s+/);
        if(parts.length > maxOutputTokens){
          const truncated = parts.slice(0, maxOutputTokens).join(' ');
          diagnostics.push({ level:'info', message:'truncated_output_tokens', data: { maxOutputTokens, originalTokens: parts.length } });
          text = truncated + ' …';
        }
      }
      if(outputCharLimit && outputCharLimit > 0 && text.length > outputCharLimit){
        const originalLength = text.length;
        text = text.slice(0, outputCharLimit) + ' …';
        diagnostics.push({ level:'info', message:'truncated_output_chars', data: { outputCharLimit, originalChars: originalLength } });
      }
      return { outputs: { output: text }, diagnostics };
    } catch(err:any){
      diagnostics.push({ level:'error', message:'ollama_error', data: { error: err?.message } });
      const assistant = `Assistant(${effectiveModel}): ${rendered}`;
      return { outputs: { output: assistant }, diagnostics };
    } finally {
      if(timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  // Default fallback (OpenAI / stub) – currently stubbed without remote API key logic.
  const assistant = `Assistant(${effectiveModel}${streaming ? ',stream' : ''}): ${rendered.split(/\r?\n/)[0].slice(0,160)}`;
  console.debug('[exec] LLM executor emitting (stub path)', { nodeId: ctx.nodeId, model: effectiveModel, provider, reason: 'not_ollama_pattern' });
  return { outputs: { output: assistant }, diagnostics };
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
