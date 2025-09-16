import React, { useCallback, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

interface FileReaderNodeData {
  nodeId?: string; id?: string; label?: string; type?: string; rawProps?: any; props?: any;
}

export const FileReaderNode: React.FC<{ data: FileReaderNodeData }> = ({ data }) => {
  const nodeId = data?.nodeId || data?.id;
  const rawProps = data?.rawProps || data?.props || {};
  const mode: 'single'|'directory' = rawProps.mode || 'single';
  const scanned: string[] = rawProps.scannedFiles || [];
  const cursor: number = typeof rawProps.cursorIndex === 'number' ? rawProps.cursorIndex : -1;
  const filePath: string | undefined = rawProps.filePath;
  const dirPath: string | undefined = rawProps.dirPath;
  const [sending, setSending] = useState(false);
  const [scanning, setScanning] = useState(false);

  const doPatch = useCallback(async(patch: any)=>{
    if(!nodeId) return;
    try {
      await fetch(`/api/nodes/${nodeId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ props: { ...rawProps, ...patch } }) });
      window.dispatchEvent(new Event('graph:refresh-request'));
    } catch(e){ console.warn('[FileReaderNode] patch error', e); }
  }, [nodeId, rawProps]);

  const onSendNext = useCallback(async()=>{
    if(sending) return;
    setSending(true);
    await doPatch({ action: 'sendNext' });
    // Immediately run executor so emission propagates
    if(nodeId){
      try {
        const runRes = await fetch(`/api/nodes/${nodeId}/run`, { method:'POST' });
        if(runRes.ok){
          const json = await runRes.json();
          if(json?.emissions?.length){
            console.debug('[FileReaderNode] run emissions', json.emissions.map((e:any)=> ({ port: e.port, preview: typeof e.value === 'string' ? e.value.slice(0,60) : e.value })) );
            // Propagate manually since executor returns outputs but emitFrom is not auto-called here
            // NOTE: run endpoint itself does not propagate; we must call emitFrom client? Instead we rely on backend auto-run logic.
          } else {
            console.debug('[FileReaderNode] run completed, no emissions');
          }
          // Trigger graph refresh to pull updated LogNode history
          window.dispatchEvent(new Event('graph:refresh-request'));
        } else {
          console.warn('[FileReaderNode] run failed', runRes.status);
        }
      } catch(err){
        console.warn('[FileReaderNode] run error', err);
      }
    }
    setTimeout(()=> setSending(false), 200); // slight delay to reduce rapid double clicks
  }, [doPatch, sending]);

  const onScan = useCallback(async()=>{
    if(scanning || mode !== 'directory') return;
    setScanning(true);
    await doPatch({ action: 'scan' });
    setTimeout(()=> setScanning(false), 200);
  }, [doPatch, scanning, mode]);

  const onReset = useCallback(async()=>{
    if(mode !== 'directory') return;
    await doPatch({ action: 'reset' });
  }, [doPatch, mode]);

  useEffect(()=>{
    // Auto-scan convenience: if directory mode with dirPath and no scannedFiles yet
    if(mode === 'directory' && dirPath && !scanned.length && !scanning){
      onScan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dirPath]);

  const handleSize = 10; const commonHandle: React.CSSProperties = { width: handleSize, height: handleSize, borderRadius: handleSize/2, border:'1px solid #3a3f45' };
  return (
    <div style={{ padding:'6px 6px 8px', border:'1px solid #4a5560', borderRadius:4, background:'#20272e', color:'#eee', fontSize:11, minWidth:180, width:220, display:'flex', flexDirection:'column', position:'relative' }}>
      <Handle type="target" position={Position.Top} style={{ ...commonHandle, background:'#888', transform:'translate(-50%, -55%)' }} />
      <div style={{ fontWeight:600, fontSize:12, marginBottom:4, textAlign:'center' }}>{data?.label || 'FileReader'}</div>
      <div style={{ flex:'0 0 auto', display:'flex', flexDirection:'column', gap:4 }}>
        {mode === 'single' && (
          <div style={{ fontSize:10, background:'#141a1f', border:'1px solid #2c3740', padding:4, borderRadius:3 }}>
            <div style={{ opacity:0.6 }}>File</div>
            <div style={{ whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{filePath || <em style={{ opacity:0.5 }}>none</em>}</div>
          </div>
        )}
        {mode === 'directory' && (
          <div style={{ fontSize:10, background:'#141a1f', border:'1px solid #2c3740', padding:4, borderRadius:3 }}>
            <div style={{ opacity:0.6 }}>Directory</div>
            <div style={{ whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>{dirPath || <em style={{ opacity:0.5 }}>none</em>}</div>
            <div style={{ marginTop:4, fontSize:9, maxHeight:60, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
              {scanned.length === 0 && <span style={{ opacity:0.4 }}>no files</span>}
              {scanned.slice(0,10).map((f, i)=> (
                <span key={f+':'+i} style={{ background: i === cursor ? '#2d3640' : 'transparent', padding:'1px 2px', borderRadius:2 }}>{f}</span>
              ))}
              {scanned.length > 10 && <span key="overflow" style={{ opacity:0.5 }}>+{scanned.length - 10} more…</span>}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:6 }}>
        {mode === 'directory' && <button onClick={onScan} disabled={scanning} style={{ flex:'0 0 auto', background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'3px 6px', borderRadius:3, fontSize:10 }}>{scanning? 'Scanning…':'Scan'}</button>}
        {mode === 'directory' && <button onClick={onReset} style={{ flex:'0 0 auto', background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'3px 6px', borderRadius:3, fontSize:10 }}>Reset</button>}
        <button data-testid={`filereader-sendnext-${nodeId}`} onClick={onSendNext} disabled={sending || (mode==='single' && !filePath)} style={{ flex:1, background:'#3a4f2f', color:'#fff', border:'1px solid #4d5c3d', padding:'3px 6px', borderRadius:3, fontSize:10 }}>{sending? '...' : 'Send/Next'}</button>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ ...commonHandle, background:'#3d8', transform:'translate(-50%, 55%)' }} />
    </div>
  );
};

export default FileReaderNode;
