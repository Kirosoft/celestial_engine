import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useUIState } from '../state/uiState';
import { buildDefaultProps } from '../lib/defaultProps';

interface NodeTypeMeta { id: string; title: string; description?: string; schemaId: string; requiredPropKeys: string[] }

export function Toolbox({ onCreate }: { onCreate?: (nodeId: string)=>void }){
  const { showToolbox, toggleToolbox, toolboxX, toolboxY, setToolboxPosition, toolboxCollapsed, setToolboxCollapsed } = useUIState() as any;
  const [types, setTypes] = useState<NodeTypeMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [creating, setCreating] = useState<string|undefined>();
  const dragRef = useRef<HTMLDivElement|null>(null);
  const dragState = useRef<{ startX:number; startY:number; baseX:number; baseY:number; dragging:boolean }>({ startX:0, startY:0, baseX:0, baseY:0, dragging:false });

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

  const onMouseDownHeader = useCallback((e: React.MouseEvent)=>{
    const target = dragRef.current; if(!target) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, baseX: toolboxX, baseY: toolboxY, dragging:true };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }, [toolboxX, toolboxY]);

  const onMouseMove = useCallback((e: MouseEvent)=>{
    if(!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    // Basic bounds (keep within viewport with margin)
    const nextX = Math.max(0, dragState.current.baseX + dx);
    const nextY = Math.max(40, dragState.current.baseY + dy);
    setToolboxPosition(nextX, nextY);
  }, [setToolboxPosition]);

  const onMouseUp = useCallback(()=>{
    if(dragState.current.dragging){
      dragState.current.dragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  }, [onMouseMove]);

  // Cleanup on unmount
  useEffect(()=>()=>{
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove, onMouseUp]);

  if(!showToolbox) return (
    <button data-testid="open-toolbox" onClick={()=>toggleToolbox(true)} style={btnStyle}>Open Toolbox</button>
  );

  return (
    <div
      data-testid="toolbox"
      ref={dragRef}
      style={{
        ...containerStyle,
        top: toolboxY,
        left: toolboxX,
        width: 200,
        cursor: dragState.current.dragging ? 'grabbing' : 'default'
      }}
    >
      <div
        data-testid="toolbox-header"
        onMouseDown={onMouseDownHeader}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, cursor:'grab', userSelect:'none' }}
      >
        <strong style={{ fontSize:13 }}>Toolbox</strong>
        <div style={{ display:'flex', gap:4 }}>
          <button
            data-testid="toolbox-collapse-toggle"
            title={toolboxCollapsed ? 'Expand' : 'Collapse'}
            onClick={()=>setToolboxCollapsed()}
            style={miniBtn}
          >{toolboxCollapsed ? '+' : '−'}</button>
          <button onClick={()=>toggleToolbox(false)} style={miniBtn} title="Close">×</button>
        </div>
      </div>
      {!toolboxCollapsed && (
        <>
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
        </>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position:'absolute', background:'#1e2730', color:'#eee', padding:10, borderRadius:6, fontSize:12, boxShadow:'0 2px 4px rgba(0,0,0,0.4)',
  maxHeight:'60vh', overflowY:'auto', zIndex:20
};
const btnStyle: React.CSSProperties = { background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'6px 8px', textAlign:'left', cursor:'pointer', borderRadius:4, fontSize:12 };
const miniBtn: React.CSSProperties = { background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'0 6px', cursor:'pointer', borderRadius:4, fontSize:14, lineHeight:'18px' };
const dimText: React.CSSProperties = { fontSize:12, color:'#999' };
