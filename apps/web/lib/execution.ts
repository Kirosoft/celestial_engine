import { nanoid } from 'nanoid';
import { getNode } from './nodeRepo';
import { readSettings } from './systemSettingsRepo';
// New execution v2 pieces
import { capabilityRegistry } from './execution/capabilityRegistry';
import { createEnvelope, enqueueEmission, drainQueue } from './execution/queue';
import { InMemoryInputBufferStore } from './execution/bufferStore';
import { getTemplate } from './templateRepo';
import Handlebars from 'handlebars';

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

// Legacy in-memory input buffers (MVP). nodeId -> port -> payload list (kept for backward compatibility during refactor)
const inputBuffers: Record<string, Record<string, EdgePayload[]>> = {};
// New per-node buffer stores (EmissionEnvelope based)
const nodeBufferStores: Record<string, InMemoryInputBufferStore> = {};
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
import { appendLogEntry } from './logHistory'; // (legacy usage will be removed when LogNode fully migrates)
import { scanDirectory, readFileSafe, parsePatternList } from './fileScanner';
import { buildVarMappings } from './execution/varMapping';

// New propagation leveraging emission queue + middlewares (replaces legacy branching logic)
export async function emitFrom(nodeId: string, port: string, value: any){
  console.debug('[exec-v2] emitFrom start', { nodeId, port, preview: typeof value === 'string' ? value.slice(0,60) : value });
  const all = await listNodes();
  const source = all.find(n=> (n as any).id === nodeId);
  if(!source) return;
  const sourceType = (source as any).type;
  const sourceCaps = capabilityRegistry.get(sourceType);
  const edges = (source as any).edges?.out || [];
  if(!edges.length){
    console.debug('[exec-v2] no outgoing edges', { nodeId });
  }
  for(const e of edges){
    const target = all.find(n=> (n as any).id === e.targetId);
    if(!target) continue;
    const targetType = (target as any).type;
    // Maintain legacy buffer for backward compatibility during migration
    appendInput(e.targetId, port, value, { edgeId: e.id, sourceNodeId: nodeId });
    // New envelope
    const env = createEnvelope({
      fromNodeId: nodeId,
      fromPort: port,
      toNodeId: e.targetId,
      toPort: port, // TODO: add port mapping when schema supports
      value,
      meta: sourceCaps?.assistantEmitter ? { role: 'assistant', edgeId: e.id } : { edgeId: e.id }
    });
    const store = nodeBufferStores[e.targetId] || (nodeBufferStores[e.targetId] = new InMemoryInputBufferStore({ maxPerPort: capabilityRegistry.get(targetType)?.maxInputBuffer }));
    enqueueEmission(env, {
      targetNodeId: e.targetId,
      targetType,
      bufferStore: store,
      getTargetProps: async () => ((target as any).props || {}),
      updateTargetProps: async (patch) => {
        (target as any).props = { ...(target as any).props || {}, ...patch };
        await updateNode((target as any).id, { props: (target as any).props });
      }
    });
  }
  // Drain queue (BFS style) and auto-run nodes as needed
  await drainQueue(async (autoNodeId, triggerEnv) => {
    // Pass runChain with source to maintain depth guard
    try {
      const run = await runNode(autoNodeId, { runChain: [nodeId] });
      if('emissions' in run && Array.isArray((run as any).emissions)){
        for(const em of (run as any).emissions){
          await emitFrom(autoNodeId, em.port, em.value);
        }
      }
    } catch(err:any){
      console.error('[exec-v2] auto-run error', { nodeId: autoNodeId, error: err?.message });
    }
  });
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
  const mappingRes = await buildVarMappings({
    nodeId: ctx.nodeId,
    template: tmpl,
    latestMap,
    inputVars,
    autoDerive,
  });
  for(const d of mappingRes.diagnostics) diagnostics.push(d);
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
  
  // === TEMPLATE INTEGRATION (PBI-37) ===
  // If useTemplate is enabled, load and render the specified template
  if (ctx.props.useTemplate && ctx.props.templateId) {
    try {
      const template = await getTemplate(ctx.props.templateId);
      diagnostics.push({ level: 'info', message: 'using_prompt_template', data: { templateId: ctx.props.templateId, category: template.category } });
      
      // Merge template variables: explicit templateVariables + input data
      const templateContext: Record<string, any> = {
        ...replacements, // Include all existing replacements (prompt, context, message, etc.)
        ...(ctx.props.templateVariables || {}), // Explicit template variables override
      };
      
      // Validate required variables
      const requiredVars = template.variables?.filter((v: any) => v.required).map((v: any) => v.name) || [];
      const missingVars = requiredVars.filter((varName: string) => !(varName in templateContext) || templateContext[varName] === '');
      if (missingVars.length > 0) {
        diagnostics.push({ level: 'error', message: 'missing_required_template_variables', data: { missing: missingVars } });
        return { 
          runId: ctx.runId, 
          error: `Missing required template variables: ${missingVars.join(', ')}`, 
          diagnostics 
        };
      }
      
      // Compile and render template
      const compiledTemplate = Handlebars.compile(template.content);
      rendered = compiledTemplate(templateContext);
      diagnostics.push({ level: 'info', message: 'template_rendered', data: { length: rendered.length, varsUsed: Object.keys(templateContext).length } });
    } catch (err: any) {
      diagnostics.push({ level: 'error', message: 'template_load_failed', data: { templateId: ctx.props.templateId, error: err?.message } });
      return { 
        runId: ctx.runId, 
        error: `Failed to load template: ${err?.message || 'unknown error'}`, 
        diagnostics 
      };
    }
  }
  // === END TEMPLATE INTEGRATION ===
  
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

// Register MCPTool executor
registerExecutor('MCPTool', async (ctx) => {
  const diagnostics: any[] = [];
  const { serverId, toolName, parameters = {}, timeout = 30000 } = ctx.props;
  
  if (!serverId || !toolName) {
    return {
      error: 'Missing required fields: serverId and toolName are required',
      diagnostics: [{ level: 'error', message: 'serverId and toolName must be specified' }]
    };
  }
  
  // Merge explicit parameters with input edge data (inputs override explicit params)
  const finalParameters = {
    ...parameters,
    ...ctx.latest
  };
  
  // Emit diagnostic: starting tool call
  diagnostics.push({
    level: 'info',
    message: 'MCP tool call started',
    data: {
      type: 'mcp_tool_start',
      serverId,
      toolName,
      parameters: finalParameters,
      timestamp: Date.now()
    }
  });
  
  try {
    // Import dynamically to avoid circular dependencies
    const { mcpClient } = await import('./mcpClient');
    
    // Invoke tool via MCP client
    const result = await mcpClient.invokeTool({
      serverId,
      toolName,
      parameters: finalParameters
    });
    
    if (result.success) {
      // Emit successful result
      diagnostics.push({
        level: 'info',
        message: 'MCP tool call succeeded',
        data: {
          type: 'mcp_tool_success',
          serverId,
          toolName,
          duration: result.duration,
          timestamp: Date.now()
        }
      });
      
      return {
        outputs: { result: result.result },
        diagnostics
      };
    } else {
      // Handle tool execution error
      diagnostics.push({
        level: 'error',
        message: 'MCP tool call failed',
        data: {
          type: 'mcp_tool_error',
          serverId,
          toolName,
          error: result.error,
          duration: result.duration,
          timestamp: Date.now()
        }
      });
      
      return {
        outputs: { error: result.error },
        error: result.error,
        diagnostics
      };
    }
  } catch (error: any) {
    // Handle connection or invocation errors
    diagnostics.push({
      level: 'error',
      message: 'MCP tool invocation error',
      data: {
        type: 'mcp_tool_error',
        serverId,
        toolName,
        error: error.message,
        timestamp: Date.now()
      }
    });
    
    return {
      outputs: { error: error.message },
      error: error.message,
      diagnostics
    };
  }
});
