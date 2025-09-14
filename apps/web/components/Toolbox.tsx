import React, { useEffect, useState, useCallback } from 'react';
import { useUIState } from '../state/uiState';
import { buildDefaultProps } from '../lib/defaultProps';

interface NodeTypeMeta { id: string; title: string; description?: string; schemaId: string; requiredPropKeys: string[] }

export function Toolbox({ onCreate }: { onCreate?: (nodeId: string)=>void }){
  const { showToolbox, toggleToolbox } = useUIState();
  const [types, setTypes] = useState<NodeTypeMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [creating, setCreating] = useState<string|undefined>();

  const load = useCallback(async ()=>{
    setLoading(true); setError(undefined);
    try {
      const res = await fetch('/api/node-types');
      if(!res.ok) throw new Error('Failed to fetch node types');
      const json = await res.json();
      setTypes(json.nodeTypes || []);
    } catch(e: any){ setError(e.message || 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); }, [load]);

  const createNode = useCallback(async (typeId: string) => {
    setCreating(typeId);
    try {
      const meta = types.find(t=> t.id === typeId);
      const props: Record<string, any> = meta ? buildDefaultProps(typeId, meta.requiredPropKeys) : {};
      const body = { type: typeId, name: typeId, props };
      const res = await fetch('/api/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if(!res.ok) throw new Error('Failed to create node');
      const json = await res.json();
      onCreate?.(json.node.id);
      window.dispatchEvent(new CustomEvent('graph:refresh-request')); // let graph hook know
    } catch(e){ console.warn('[Toolbox] create failed', e); }
    finally { setCreating(undefined); }
  }, [onCreate, types]);

  if(!showToolbox) return (
    <button onClick={()=>toggleToolbox(true)} style={btnStyle}>Open Toolbox</button>
  );

  return (
    <div style={containerStyle}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <strong style={{ fontSize:13 }}>Toolbox</strong>
        <button onClick={()=>toggleToolbox(false)} style={miniBtn}>×</button>
      </div>
      {loading && <div style={dimText}>Loading types…</div>}
      {error && <div style={{ color:'#f66', fontSize:12 }}>{error}</div>}
      {!loading && !error && types.length === 0 && <div style={dimText}>No types found</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {types.map(t => (
          <button key={t.id} style={btnStyle} disabled={!!creating} onClick={()=>createNode(t.id)}>
            {creating === t.id ? 'Creating…' : t.title}
          </button>
        ))}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position:'absolute', top:60, left:10, width:180, background:'#1e2730', color:'#eee', padding:10, borderRadius:6, fontSize:12, boxShadow:'0 2px 4px rgba(0,0,0,0.4)',
  maxHeight:'60vh', overflowY:'auto'
};
const btnStyle: React.CSSProperties = { background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'6px 8px', textAlign:'left', cursor:'pointer', borderRadius:4, fontSize:12 };
const miniBtn: React.CSSProperties = { background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'0 6px', cursor:'pointer', borderRadius:4, fontSize:14, lineHeight:'18px' };
const dimText: React.CSSProperties = { fontSize:12, color:'#999' };
