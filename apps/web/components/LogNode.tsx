import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

interface LogEntry { id: string; ts: number; sourceId?: string; port?: string; kind?: string; preview: string }

export const LogNode: React.FC<any> = ({ data }) => {
  const nodeId: string = data?.nodeId || data?.id;
  const history: LogEntry[] = data?.history || [];
  const maxEntries: number | undefined = data?.maxEntries;
  const filterIncludes: string[] = data?.filterIncludes || [];
  const rawProps = data?.rawProps || {};
  const [localHistory, setLocalHistory] = useState<LogEntry[]>(history);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef<HTMLDivElement|null>(null);
  // Resizing
  const initialWidth = (rawProps && typeof rawProps.width === 'number') ? rawProps.width : 260;
  const initialContentHeight = (rawProps && typeof rawProps.contentHeight === 'number') ? rawProps.contentHeight : 160;
  const [width, setWidth] = useState<number>(initialWidth);
  const [contentHeight, setContentHeight] = useState<number>(initialContentHeight);
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number }|null>(null);

  useEffect(()=>{ setLocalHistory(history); }, [history]);
  useEffect(()=>{ const el = scrollRef.current; if(el) el.scrollTop = el.scrollHeight; }, [localHistory.length]);

  const onClear = useCallback(async ()=>{
    if(clearing) return;
    setClearing(true);
    try {
      const patch = { props: { ...rawProps, history: [] } };
      const res = await fetch(`/api/nodes/${nodeId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch) });
      if(res.ok){
        setLocalHistory([]);
        window.dispatchEvent(new Event('graph:refresh-request'));
      } else {
        console.warn('[LogNode] clear failed', res.status);
      }
    } catch(e){ console.warn('[LogNode] clear error', e); }
    finally { setClearing(false); }
  }, [nodeId, rawProps, clearing]);

  const persistSize = useCallback(async (w:number, h:number)=>{
    try {
      const patch = { props: { ...rawProps, width: w, contentHeight: h } };
      await fetch(`/api/nodes/${nodeId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch) });
      window.dispatchEvent(new Event('graph:refresh-request'));
    } catch(e){ console.warn('[LogNode] persist size error', e); }
  }, [nodeId, rawProps]);

  const onResizeStart = useCallback((e: React.MouseEvent)=>{
    e.preventDefault(); e.stopPropagation();
    resizingRef.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: contentHeight };
    window.addEventListener('mousemove', onResizing as any);
    window.addEventListener('mouseup', onResizeEnd as any, { once: true });
  }, [width, contentHeight]);

  const onResizing = useCallback((e: MouseEvent)=>{
    if(!resizingRef.current) return;
    const dx = e.clientX - resizingRef.current.startX;
    const dy = e.clientY - resizingRef.current.startY;
    let newW = Math.min(1200, Math.max(140, resizingRef.current.startW + dx));
    let newH = Math.min(800, Math.max(80, resizingRef.current.startH + dy));
    setWidth(newW); setContentHeight(newH);
  }, []);

  const onResizeEnd = useCallback(()=>{
    if(resizingRef.current){
      persistSize(width, contentHeight);
    }
    resizingRef.current = null;
    window.removeEventListener('mousemove', onResizing as any);
  }, [persistSize, width, contentHeight, onResizing]);

  useEffect(()=>{ return ()=> { window.removeEventListener('mousemove', onResizing as any); }; }, [onResizing]);

  const handleSize = 10;
  const commonHandle: React.CSSProperties = { width: handleSize, height: handleSize, borderRadius: handleSize/2, border:'1px solid #3a3f45' };

  return (
    <div style={{ padding:'6px 6px 8px', border:'1px solid #4a5560', borderRadius:4, background:'#1d242b', color:'#eee', fontSize:11, minWidth:230, width, display:'flex', flexDirection:'column', position:'relative' }}>
      <Handle type="target" position={Position.Top} style={{ ...commonHandle, background:'#888', transform:'translate(-50%, -55%)' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ fontWeight:600, fontSize:12 }}>{data?.label || 'Log'}</div>
        <div style={{ fontSize:10, opacity:0.7 }}>{localHistory.length}</div>
      </div>
  <div ref={scrollRef} style={{ flex:`0 0 ${contentHeight}px`, height: contentHeight, overflowY:'auto', overflowX:'auto', background:'#141a1f', border:'1px solid #2c3740', padding:4, borderRadius:3, display:'flex', flexDirection:'column', gap:3 }}>
        {localHistory.length === 0 && <div style={{ opacity:0.5, fontStyle:'italic' }}>No entries</div>}
        {localHistory.map(e => (
          <div key={e.id} style={{ background:'#222b33', padding:'3px 5px', borderRadius:3, lineHeight:1.2, fontFamily:'monospace', fontSize:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', opacity:0.6 }}>
              <span>{new Date(e.ts).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
              <span>{e.kind || ''}</span>
            </div>
            <div style={{ whiteSpace:'pre', overflow:'visible' }} title={e.preview}>
              {e.sourceId && <span style={{ color:'#6aa' }}>{e.sourceId.split('-')[0]}</span>} {e.port && <span style={{ color:'#9a6' }}>[{e.port}]</span>} {e.preview}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={onClear} disabled={clearing} style={{ background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'4px 6px', cursor:clearing?'default':'pointer', borderRadius:3, fontSize:11 }}>
          {clearing? 'Clearing…':'Clear'}
        </button>
        {filterIncludes.length > 0 && <div style={{ fontSize:9, opacity:0.6 }}>filters:{filterIncludes.length}</div>}
      </div>
      <div
        onMouseDown={(e)=>{ e.stopPropagation(); onResizeStart(e); }}
        className="nodrag"
        style={{ position:'absolute', width:14, height:14, right:2, bottom:2, cursor:'nwse-resize', display:'flex', alignItems:'flex-end', justifyContent:'flex-end', pointerEvents:'auto' }}>
        <div style={{ width:10, height:10, borderRight:'2px solid #556', borderBottom:'2px solid #556', borderRadius:2, opacity:0.8 }} />
      </div>
    </div>
  );
};

export default LogNode;
