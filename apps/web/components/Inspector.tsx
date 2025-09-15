import React, { useEffect, useState, useCallback, FormEvent, useRef } from 'react';
import { useUIState } from '../state/uiState';

interface NodeData { id: string; type: string; name: string; position?: { x:number; y:number }; props?: any }
interface SchemaProperty { type?: string; title?: string; description?: string; enum?: any[] }
interface NodeTypeSchema { title?: string; properties?: Record<string, SchemaProperty>; required?: string[] }

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T>{
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let body: any;
  try { body = await res.json(); } catch { /* ignore parse error */ }
  if(!res.ok){
    const err: any = new Error(body?.error?.message || res.statusText);
    if(body?.error?.fields){
      err.fields = body.error.fields; // expecting array of { path, message }
    }
    throw err;
  }
  return body as T;
}

interface EdgeView { id: string; sourceId: string; targetId: string; kind: string }

export function Inspector(){
  const { selectedNodeId, selectedEdgeId, selectionAction, showInspector, toggleInspector, setSelectedNodeIds, setSelectedEdge, inspectorWidth, setInspectorWidth, currentGroupId } = useUIState() as any;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [node, setNode] = useState<NodeData|undefined>();
  const [edge, setEdge] = useState<EdgeView|undefined>();
  const [edgeKindDraft, setEdgeKindDraft] = useState<string>('flow');
  const [edgeDirty, setEdgeDirty] = useState(false);
  const [schema, setSchema] = useState<NodeTypeSchema|undefined>();
  const [draftName, setDraftName] = useState('');
  const [draftProps, setDraftProps] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const [original, setOriginal] = useState<{ name: string; props: Record<string,any> }>({ name:'', props:{} });

  // Load node + schema on selection change
  useEffect(()=>{
    if(!selectedNodeId){ setNode(undefined); setSchema(undefined); setDirty(false); }
    if(!selectedNodeId) return;
    if(currentGroupId && selectedNodeId === currentGroupId){
      // Group root selected while inside group context: treat as non-inspectable placeholder
      setNode(undefined); setSchema(undefined); setDirty(false); return;
    }
    let cancelled = false;
    (async ()=>{
      setLoading(true); setError(undefined); setFieldErrors({}); setDirty(false);
      try {
        const base = currentGroupId ? `/api/groups/${currentGroupId}/nodes/${selectedNodeId}` : `/api/nodes/${selectedNodeId}`;
        const nodeResp = await fetchJson<{ node: NodeData }>(base);
        if(cancelled) return;
        setNode(nodeResp.node);
        setDraftName(nodeResp.node.name);
        setDraftProps({ ...(nodeResp.node.props||{}) });
        setOriginal({ name: nodeResp.node.name, props: { ...(nodeResp.node.props||{}) } });
        // Fetch single schema for this node type
        try {
          const schemaResp = await fetchJson<{ schema: NodeTypeSchema }>(`/api/schemas/${encodeURIComponent(nodeResp.node.type)}`);
          if(cancelled) return;
          setSchema(schemaResp.schema || { properties: {} });
        } catch(e){
          // Fallback: leave schema empty (renders "No props")
          if(!cancelled) setSchema({ properties: {} });
        }
      } catch(e:any){ if(!cancelled) setError(e.message||String(e)); }
      finally { if(!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  }, [selectedNodeId, selectionAction, currentGroupId]);

  // Edge load: derive minimal edge info from id pattern (source:edgeId), fetch source node to extract edge metadata
  useEffect(()=>{
    if(!selectedEdgeId){ setEdge(undefined); setEdgeDirty(false); return; }
    const parts = selectedEdgeId.split(':');
    if(parts.length !== 2){ setEdge(undefined); return; }
    const [sourceId, edgeId] = parts;
    let cancelled = false;
    (async ()=>{
      setLoading(true); setError(undefined);
      try {
        if(currentGroupId){
          // Load subgroup edges from subgraph endpoint
            const sg = await fetchJson<{ nodes: any[]; edges: any[] }>(`/api/groups/${currentGroupId}/subgraph`);
            if(cancelled) return;
            const e = sg.edges.find(e=> e.id === edgeId && e.sourceId === sourceId);
            if(e){
              setEdge({ id: e.id, sourceId: e.sourceId, targetId: e.targetId, kind: e.kind || 'flow' });
              setEdgeKindDraft(e.kind || 'flow');
              setEdgeDirty(false);
            } else {
              setEdge(undefined);
            }
        } else {
          // Root graph edge: derive from source node file
          const sourceResp = await fetchJson<{ node: NodeData }>(`/api/nodes/${sourceId}`);
          if(cancelled) return;
          const edgeObj = (sourceResp.node as any)?.edges?.out?.find((e: any)=> e.id === edgeId);
          if(edgeObj){
            setEdge({ id: edgeObj.id, sourceId, targetId: edgeObj.targetId, kind: edgeObj.kind || 'flow' });
            setEdgeKindDraft(edgeObj.kind || 'flow');
            setEdgeDirty(false);
          } else {
            setEdge(undefined);
          }
        }
      } catch(e:any){ if(!cancelled) setError(e.message||String(e)); }
      finally { if(!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  }, [selectedEdgeId, currentGroupId]);

  const onPropChange = useCallback((key: string, value: any)=>{
    setDraftProps(p=>({ ...p, [key]: value }));
    setDirty(true);
  }, []);

  const onNameChange = useCallback((v: string)=>{ setDraftName(v); setDirty(true); }, []);

  const onSubmit = useCallback(async (e: FormEvent)=>{
    e.preventDefault(); if(!node) return;
    setSaving(true); setFieldErrors({}); setError(undefined);
    try {
      const patch = { name: draftName, props: draftProps };
      const url = currentGroupId ? `/api/groups/${currentGroupId}/nodes/${node.id}` : `/api/nodes/${node.id}`;
      const updated = await fetchJson<{ node: NodeData }>(url, { method:'PUT', body: JSON.stringify(patch) });
      setNode(updated.node); setDirty(false);
      // Dispatch label update for canvas re-render
      try {
        window.dispatchEvent(new CustomEvent('graph:update-node-label', { detail: { id: updated.node.id, name: updated.node.name } }));
      } catch { /* ignore */ }
    } catch(e:any){
      if(e.fields && Array.isArray(e.fields)){
        const fe: Record<string,string> = {};
        for(const f of e.fields){
          // path like props.maxTasks or name
            const path: string = f.path || '';
            if(path.startsWith('props.')){
              const key = path.substring('props.'.length);
              fe[key] = f.message || 'Invalid value';
            } else if(path === 'name'){
              fe['__name'] = f.message || 'Invalid name';
            }
        }
        setFieldErrors(fe);
        if(!Object.keys(fe).length){ setError(e.message||'Save failed'); }
      } else {
        setError(e.message||'Save failed');
      }
    } finally { setSaving(false); }
  }, [node, draftName, draftProps, currentGroupId]);

  const resetDraft = useCallback(()=>{
    setDraftName(original.name);
    setDraftProps({ ...original.props });
    setDirty(false);
    setFieldErrors({});
    setError(undefined);
  }, [original]);

  const onDeleteNode = useCallback(async ()=>{
    if(!node) return;
    const isProxy = node.type === 'GroupInputProxy' || node.type === 'GroupOutputProxy' || node.id.startsWith('__input_') || node.id.startsWith('__output_');
    if(isProxy){
      setError('Proxy nodes are managed via group ports and cannot be deleted directly.');
      return;
    }
    if(!confirm(`Delete node ${node.name || node.id}? This cannot be undone.`)) return;
    try {
      let res: Response;
      if(currentGroupId){
        res = await fetch(`/api/groups/${currentGroupId}/nodes/${node.id}`, { method:'DELETE' });
      } else {
        res = await fetch(`/api/nodes/${node.id}`, { method:'DELETE' });
      }
      if(res.ok){
        setNode(undefined);
        setSelectedNodeIds([]);
        window.dispatchEvent(new Event('graph:refresh-request'));
      } else {
        const body = await res.json().catch(()=>undefined);
        setError(body?.error?.message || 'Failed to delete node');
      }
    } catch(e:any){ setError(e.message||'Delete failed'); }
  }, [node, setSelectedNodeIds, currentGroupId]);

  const onDeleteEdge = useCallback(async ()=>{
    if(!edge) return;
    if(!confirm(`Delete edge ${edge.id}?`)) return;
    try {
      const url = currentGroupId ? `/api/groups/${currentGroupId}/edges/${edge.id}` : `/api/edges/${edge.sourceId}/${edge.id}`;
      const res = await fetch(url, { method:'DELETE' });
      if(res.ok){
        setEdge(undefined);
        setSelectedEdge(undefined);
        window.dispatchEvent(new Event('graph:refresh-request'));
      } else {
        setError('Failed to delete edge');
      }
    } catch(e:any){ setError(e.message||'Delete edge failed'); }
  }, [edge, setSelectedEdge, currentGroupId]);

  const onSaveEdge = useCallback(async ()=>{
    if(!edge || !edgeDirty) return;
    try {
      const url = currentGroupId ? `/api/groups/${currentGroupId}/edges/${edge.id}` : `/api/edges/${edge.sourceId}/${edge.id}`;
      const res = await fetch(url, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ kind: edgeKindDraft }) });
      if(!res.ok){
        const body = await res.json().catch(()=>undefined);
        setError(body?.error?.message || 'Failed to update edge');
        return;
      }
      setEdge(e => e ? { ...e, kind: edgeKindDraft } : e);
      setEdgeDirty(false);
      window.dispatchEvent(new Event('graph:refresh-request'));
    } catch(e:any){ setError(e.message||'Update edge failed'); }
  }, [edge, edgeKindDraft, edgeDirty, currentGroupId]);

  const onResetEdge = useCallback(()=>{
    if(edge){ setEdgeKindDraft(edge.kind); setEdgeDirty(false); setError(undefined); }
  }, [edge]);

  // Resize logic
  const resizeRef = useRef<{ startX:number; baseWidth:number; active:boolean }>({ startX:0, baseWidth:0, active:false });
  const onResizeDown = useCallback((e: React.MouseEvent)=>{
    resizeRef.current = { startX: e.clientX, baseWidth: inspectorWidth, active:true };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
    e.preventDefault();
  }, [inspectorWidth]);
  const onResizeMove = useCallback((e: MouseEvent)=>{
    if(!resizeRef.current.active) return;
    const dx = resizeRef.current.startX - e.clientX; // dragging left handle left increases width
    setInspectorWidth(resizeRef.current.baseWidth + dx);
  }, [setInspectorWidth]);
  const onResizeUp = useCallback(()=>{
    if(resizeRef.current.active){
      resizeRef.current.active = false;
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', onResizeUp);
    }
  }, [onResizeMove]);
  useEffect(()=>()=>{ onResizeUp(); }, [onResizeUp]);
  const onDoubleClickHandle = useCallback(()=>{ setInspectorWidth(320); }, [setInspectorWidth]);

  if(!showInspector) return null;
  return (
    <div style={{ position:'absolute', top:0, right:0, width:inspectorWidth, height:'100%', background:'#141a21', color:'#eee', borderLeft:'1px solid #233', display:'flex', flexDirection:'column', fontSize:12 }}>
      <div
        data-testid="inspector-resize-handle"
        onMouseDown={onResizeDown}
        onDoubleClick={onDoubleClickHandle}
        style={{ position:'absolute', left:0, top:0, bottom:0, width:6, cursor:'col-resize', transform:'translateX(-6px)', background: resizeRef.current.active? 'rgba(255,255,255,0.15)':'transparent' }}
        title="Drag to resize (double-click to reset)"
      />
      <div style={{ padding:'8px 10px', borderBottom:'1px solid #233', display:'flex', alignItems:'center', gap:8, marginLeft:0 }}>
        <strong style={{ fontSize:13 }}>Inspector</strong>
        <button onClick={()=>toggleInspector(false)} style={{ marginLeft:'auto', background:'transparent', color:'#888', border:'none', cursor:'pointer' }}>×</button>
      </div>
      {!selectedNodeId && !selectedEdgeId && <div style={{ padding:12 }}>No selection.</div>}
      {selectedNodeId && (
        <form onSubmit={onSubmit} style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column' }}>
          {loading && <div style={{ padding:12 }}>Loading…</div>}
          {error && <div style={{ padding:12, color:'#f66' }}>{error}</div>}
          {node && !loading && (
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:4 }}>Name</label>
                <textarea
                  data-testid="inspector-name"
                  value={draftName}
                  onChange={e=>onNameChange(e.target.value)}
                  rows={3}
                  style={{ width:'100%', fontFamily:'inherit', fontSize:'inherit', resize:'vertical', lineHeight:1.3, padding:4 }}
                />
                {fieldErrors['__name'] && <div style={{ fontSize:10, color:'#f55' }}>{fieldErrors['__name']}</div>}
              </div>
              <div style={{ fontSize:11, opacity:0.7 }}>ID: {node.id}</div>
              <div style={{ fontSize:11, opacity:0.7 }}>Type: {node.type}</div>
              {node.position && <div style={{ fontSize:11, opacity:0.7 }}>Position: {Math.round(node.position.x)}, {Math.round(node.position.y)}</div>}
              <fieldset style={{ border:'1px solid #233', padding:8 }}>
                <legend style={{ padding:'0 4px' }}>Props</legend>
                {renderPropsForm(schema, draftProps, onPropChange, fieldErrors)}
              </fieldset>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button type="submit" disabled={saving || !dirty} style={{ padding:'6px 12px' }}>{saving? 'Saving…': 'Save'}</button>
                <button type="button" disabled={!dirty || saving} onClick={resetDraft} style={{ padding:'6px 10px' }}>Reset</button>
                <button
                  type="button"
                  onClick={onDeleteNode}
                  disabled={node && (node.type === 'GroupInputProxy' || node.type === 'GroupOutputProxy' || node.id.startsWith('__input_') || node.id.startsWith('__output_'))}
                  style={{ marginLeft:'auto', padding:'6px 10px', background:'#612', opacity: (node && (node.type === 'GroupInputProxy' || node.type === 'GroupOutputProxy' || node.id.startsWith('__input_') || node.id.startsWith('__output_')))?0.4:1, color:'#fff', border:'1px solid #a44' }}
                >Delete</button>
                {dirty && <span style={{ color:'#fb0' }}>Unsaved changes</span>}
                {currentGroupId && <span style={{ fontSize:10, color:'#aaa' }}>Group context edit (ports & subgraph settings immutable)</span>}
              </div>
            </div>
          )}
        </form>
      )}
      {selectedEdgeId && !selectedNodeId && (
        <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column' }}>
          {loading && <div style={{ padding:12 }}>Loading…</div>}
          {error && <div style={{ padding:12, color:'#f66' }}>{error}</div>}
          {edge && !loading && (
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>Edge</div>
              <div style={{ fontSize:11, opacity:0.7 }}>ID: {edge.id}</div>
              <div style={{ fontSize:11, display:'flex', gap:6, alignItems:'center' }}>
                <span>Kind:</span>
                <select value={edgeKindDraft} onChange={e=>{ setEdgeKindDraft(e.target.value); setEdgeDirty(e.target.value !== edge.kind); }} style={{ fontSize:11 }}>
                  <option value="flow">flow</option>
                  <option value="data">data</option>
                </select>
                {edgeDirty && <span style={{ color:'#fb0' }}>modified</span>}
              </div>
              <div style={{ fontSize:11 }}>Source: <a href="#" onClick={(e)=>{ e.preventDefault(); setSelectedEdge(undefined); setSelectedNodeIds([edge.sourceId]); }}>{edge.sourceId}</a></div>
              <div style={{ fontSize:11 }}>Target: <a href="#" onClick={(e)=>{ e.preventDefault(); setSelectedEdge(undefined); setSelectedNodeIds([edge.targetId]); }}>{edge.targetId}</a></div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                <button type="button" disabled={!edgeDirty} onClick={onSaveEdge} style={{ padding:'6px 10px' }}>Save</button>
                <button type="button" disabled={!edgeDirty} onClick={onResetEdge} style={{ padding:'6px 10px' }}>Reset</button>
                <button type="button" onClick={onDeleteEdge} style={{ padding:'6px 10px', background:'#612', color:'#fff', border:'1px solid #a44', marginLeft:'auto' }}>Delete Edge</button>
              </div>
              {currentGroupId && <div style={{ fontSize:10, opacity:0.6 }}>Subgraph edge (local to group {currentGroupId})</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderPropsForm(schema: NodeTypeSchema | undefined, draft: Record<string, any>, onChange: (k:string,v:any)=>void, errors: Record<string,string>){
  // Support node schemas where props are nested under properties.props.properties
  const propsDef: any = schema?.properties?.props;
  const propsProperties: Record<string, SchemaProperty> | undefined = propsDef?.properties || schema?.properties || undefined;
  // If we detected nested form (props key present), only use its children, not top-level structural keys
  const usingNested = !!propsDef?.properties;
  if(!propsProperties) return <div style={{ fontStyle:'italic', opacity:0.6 }}>No props</div>;
  let entries = Object.entries(propsProperties);
  if(usingNested){
    // Filter out structural keys if accidentally mixed
    entries = entries.filter(([k])=> true);
  } else {
    // If not nested, attempt to remove known structural keys
    const structural = new Set(['id','type','name','position','edges','props']);
    entries = entries.filter(([k])=> !structural.has(k));
  }
  if(!entries.length) return <div style={{ fontStyle:'italic', opacity:0.6 }}>No props</div>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {entries.map(([key, def])=>{
        const type = def.type || inferTypeFromValue(draft[key]);
        const value = draft[key] ?? '';
        const label = def.title || key;
        const err = errors[key];
        return (
          <div key={key} data-testid={`prop-${key}`} style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontWeight:500 }}>{label}</label>
            {renderField(type, value, v=> onChange(key, v), def, key)}
            {def.description && <div style={{ fontSize:10, opacity:0.6 }}>{def.description}</div>}
            {err && <div style={{ fontSize:10, color:'#f55' }}>{err}</div>}
          </div>
        );
      })}
    </div>
  );
}

function renderField(type: string|undefined, value: any, onChange:(v:any)=>void, def: SchemaProperty, key?: string){
  if(def.enum){
    return (
      <select value={value} onChange={e=>onChange(e.target.value)}>
        {def.enum.map(opt=> <option key={String(opt)} value={opt}>{String(opt)}</option>)}
      </select>
    );
  }
  switch(type){
    case 'number': return <input type="number" value={value} onChange={e=>onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'boolean': return (
      <select value={String(value)} onChange={e=>onChange(e.target.value === 'true')}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
    case 'string':
    default: {
      const str = value ?? '';
      // Heuristic rows: at least 2, up to 8 based on line count
      const rows = Math.min(8, Math.max(2, String(str).split('\n').length));
      return (
        <textarea
          data-testid={key ? `prop-${key}-field` : undefined}
          value={str}
          onChange={e=>onChange(e.target.value)}
          rows={rows}
          style={{ width:'100%', fontFamily:'inherit', fontSize:'inherit', resize:'vertical', lineHeight:1.3, padding:4 }}
        />
      );
    }
  }
}

function inferTypeFromValue(v: any): string | undefined {
  if(v === null || v === undefined) return undefined;
  if(typeof v === 'number') return 'number';
  if(typeof v === 'boolean') return 'boolean';
  if(typeof v === 'string') return 'string';
  return undefined;
}

export default Inspector;