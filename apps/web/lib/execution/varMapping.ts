import { listNodes } from '../nodeRepo';
import { readFileSafe } from '../fileScanner';

export interface VarMappingOptions {
  nodeId: string;
  template: string; // prompt template to detect referenced vars
  latestMap: Record<string, any>; // mutable map of latest values (may be augmented with cold pulls)
  inputVars: Array<{ port: string; var: string; kind?: string }>;
  autoDerive: boolean;
  logger?: Console;
}

export interface VarMappingResult {
  latestMap: Record<string, any>; // possibly enriched
  inputVars: Array<{ port: string; var: string; kind?: string }>; // possibly augmented
  diagnostics: Array<{ level: string; message: string; data?: any }>;
}

/**
 * Extracts / augments variable mappings for an LLM-like node.
 * Responsibilities:
 *  - Scan incoming data edges (kind==='data') to derive implicit variable names
 *  - Perform "cold pulls" of source node props/files when template references or autoDerive is enabled
 *  - Add implicit inputVars entries when we can map a payload key to a variable name
 *  - Emit structured diagnostics for observability (mirrors previous inline logic)
 */
export async function buildVarMappings(opts: VarMappingOptions): Promise<VarMappingResult> {
  const diagnostics: VarMappingResult['diagnostics'] = [];
  const { nodeId, template: tmpl, latestMap, inputVars, autoDerive } = opts;
  try {
    const allNodes = await listNodes();
    const latestKeys = new Set(Object.keys(latestMap));
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    for(const n of allNodes){
      const outs = (n as any).edges?.out || [];
      for(const e of outs){
        if(e.targetId !== nodeId || e.kind !== 'data') continue;
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
        if(!provided){
          const fallbackKeys = [e.sourcePort, e.varName, varName, 'file', 'data', 'output'].filter(Boolean) as string[];
          const existing = fallbackKeys.find(k=> latestKeys.has(k));
            if(existing){ payloadKey = existing; provided = true; }
        }
        if(!provided) continue;
        if(!payloadKey) payloadKey = varName;
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
  return { latestMap, inputVars, diagnostics };
}
