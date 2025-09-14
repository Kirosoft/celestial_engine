import React, { useEffect, useState, useCallback, FormEvent } from 'react';
import { useUIState } from '../state/uiState';

interface NodeData { id: string; type: string; name: string; position?: { x:number; y:number }; props?: any }
interface SchemaProperty { type?: string; title?: string; description?: string; enum?: any[] }
interface NodeTypeSchema { title?: string; properties?: Record<string, SchemaProperty>; required?: string[] }

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T>{
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if(!res.ok){
    let body: any = undefined;
    try { body = await res.json(); } catch{}
    throw new Error(body?.error?.message || res.statusText);
  }
  return res.json();
}

export function Inspector(){
  const { selectedNodeId, selectionAction, showInspector, toggleInspector } = useUIState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [node, setNode] = useState<NodeData|undefined>();
  const [schema, setSchema] = useState<NodeTypeSchema|undefined>();
  const [draftName, setDraftName] = useState('');
  const [draftProps, setDraftProps] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});

  // Load node + schema on selection change
  useEffect(()=>{
    if(!selectedNodeId){ setNode(undefined); setSchema(undefined); return; }
    let cancelled = false;
    (async ()=>{
      setLoading(true); setError(undefined); setFieldErrors({}); setDirty(false);
      try {
        const nodeResp = await fetchJson<{ node: NodeData }>(`/api/nodes/${selectedNodeId}`);
        if(cancelled) return;
        setNode(nodeResp.node);
        setDraftName(nodeResp.node.name);
        setDraftProps({ ...(nodeResp.node.props||{}) });
        // Opportunistically fetch all schemas list then pick by type (reuse existing endpoint /api/node-types)
        const meta = await fetchJson<{ nodeTypes: { type: string; schema: NodeTypeSchema }[] }>(`/api/node-types`);
        if(cancelled) return;
        const match = meta.nodeTypes.find(nt=> nt.type === nodeResp.node.type);
        setSchema(match?.schema || { properties: {} });
      } catch(e:any){ if(!cancelled) setError(e.message||String(e)); }
      finally { if(!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  }, [selectedNodeId, selectionAction]);

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
      const updated = await fetchJson<{ node: NodeData }>(`/api/nodes/${node.id}`, { method:'PUT', body: JSON.stringify(patch) });
      setNode(updated.node); setDirty(false);
    } catch(e:any){
      // TODO: Map backend validation error structure to fieldErrors; placeholder simple message
      setError(e.message||'Save failed');
    } finally { setSaving(false); }
  }, [node, draftName, draftProps]);

  if(!showInspector) return null;
  return (
    <div style={{ position:'absolute', top:0, right:0, width:320, height:'100%', background:'#141a21', color:'#eee', borderLeft:'1px solid #233', display:'flex', flexDirection:'column', fontSize:12 }}>
      <div style={{ padding:'8px 10px', borderBottom:'1px solid #233', display:'flex', alignItems:'center', gap:8 }}>
        <strong style={{ fontSize:13 }}>Inspector</strong>
        <button onClick={()=>toggleInspector(false)} style={{ marginLeft:'auto', background:'transparent', color:'#888', border:'none', cursor:'pointer' }}>×</button>
      </div>
      {!selectedNodeId && <div style={{ padding:12 }}>No node selected.</div>}
      {selectedNodeId && (
        <form onSubmit={onSubmit} style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column' }}>
          {loading && <div style={{ padding:12 }}>Loading…</div>}
          {error && <div style={{ padding:12, color:'#f66' }}>{error}</div>}
          {node && !loading && (
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:4 }}>Name</label>
                <input value={draftName} onChange={e=>onNameChange(e.target.value)} style={{ width:'100%' }} />
              </div>
              <div style={{ fontSize:11, opacity:0.7 }}>ID: {node.id}</div>
              <div style={{ fontSize:11, opacity:0.7 }}>Type: {node.type}</div>
              {node.position && <div style={{ fontSize:11, opacity:0.7 }}>Position: {Math.round(node.position.x)}, {Math.round(node.position.y)}</div>}
              <fieldset style={{ border:'1px solid #233', padding:8 }}>
                <legend style={{ padding:'0 4px' }}>Props</legend>
                {renderPropsForm(schema, draftProps, onPropChange, fieldErrors)}
              </fieldset>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button type="submit" disabled={saving || !dirty} style={{ padding:'6px 12px' }}>{saving? 'Saving…':'Save'}</button>
                {dirty && <span style={{ color:'#fb0' }}>Unsaved changes</span>}
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function renderPropsForm(schema: NodeTypeSchema | undefined, draft: Record<string, any>, onChange: (k:string,v:any)=>void, errors: Record<string,string>){
  if(!schema?.properties) return <div style={{ fontStyle:'italic', opacity:0.6 }}>No props</div>;
  const entries = Object.entries(schema.properties);
  if(!entries.length) return <div style={{ fontStyle:'italic', opacity:0.6 }}>No props</div>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {entries.map(([key, def])=>{
        const type = def.type || inferTypeFromValue(draft[key]);
        const value = draft[key] ?? '';
        const label = def.title || key;
        const err = errors[key];
        return (
          <div key={key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontWeight:500 }}>{label}</label>
            {renderField(type, value, v=> onChange(key, v), def)}
            {def.description && <div style={{ fontSize:10, opacity:0.6 }}>{def.description}</div>}
            {err && <div style={{ fontSize:10, color:'#f55' }}>{err}</div>}
          </div>
        );
      })}
    </div>
  );
}

function renderField(type: string|undefined, value: any, onChange:(v:any)=>void, def: SchemaProperty){
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
    default:
      return <input value={value} onChange={e=>onChange(e.target.value)} />;
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