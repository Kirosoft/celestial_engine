import React, { useState, useRef, useEffect, useCallback } from 'react';
import { appendEntry, ChatEntry } from '../lib/chatHistory';
import { Handle, Position } from 'reactflow';

export const ChatNode: React.FC<any> = ({ data }) => {
  const nodeId: string = data?.nodeId || data?.id;
  const history: ChatEntry[] = data?.history || [];
  const maxEntries: number | undefined = data?.maxEntries;
  const rawProps = data?.rawProps || {};
  const [composer, setComposer] = useState('');
  const [localHistory, setLocalHistory] = useState<ChatEntry[]>(history);
  const scrollRef = useRef<HTMLDivElement|null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(()=>{
    console.debug('[ChatNode] mount', { nodeId, initialHistory: history.length });
    const el = scrollRef.current; if(!el) return;
    el.scrollTop = el.scrollHeight;
  }, [localHistory.length]);

  useEffect(()=>{
    if(history.length !== localHistory.length){
      console.debug('[ChatNode] external history change detected', { nodeId, old: localHistory.length, next: history.length });
      setLocalHistory(history);
    }
  }, [history, localHistory.length]);

  const onSend = useCallback(async ()=>{
    if(!composer.trim() || saving) return;
    console.debug('[ChatNode] onSend start', { nodeId, composerPreview: composer.slice(0,40), historySize: localHistory.length });
    const next = appendEntry(localHistory, { role: 'user', content: composer.trim() }, maxEntries || rawProps.maxEntries || 200);
    console.debug('[ChatNode] appendEntry', { nodeId, newSize: next.length });
    setLocalHistory(next);
    setComposer('');
    setSaving(true);
    try {
      const patch = { props: { ...rawProps, history: next } };
      console.debug('[ChatNode] persisting history', { nodeId, historySize: next.length });
      const res = await fetch(`/api/nodes/${nodeId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch) });
      if(!res.ok){
        console.warn('[ChatNode] persist failed', res.status);
      } else {
        // Emit user message on logical 'message' port (MVP: port name reused by consumers)
  // Call server API to emit so we don't bundle fs-dependent server code client-side
  console.debug('[ChatNode] emitting message', { nodeId, contentLength: composer.trim().length });
  await fetch(`/api/nodes/${nodeId}/emit`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ port:'message', value: composer.trim() }) });
        console.debug('[ChatNode] emit request sent', { nodeId });
        window.dispatchEvent(new Event('graph:refresh-request'));
      }
    } catch(e){ console.warn('[ChatNode] error', e); }
    finally { setSaving(false); }
  }, [composer, localHistory, maxEntries, rawProps, nodeId, saving]);

  const onKeyDown = useCallback((e: React.KeyboardEvent)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  const onClear = useCallback(async ()=>{
    if(clearing || saving || localHistory.length === 0) return;
    console.debug('[ChatNode] onClear start', { nodeId, currentSize: localHistory.length });
    setClearing(true);
    try {
      const patch = { props: { ...rawProps, history: [] } };
      const res = await fetch(`/api/nodes/${nodeId}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch) });
      if(!res.ok){
        console.warn('[ChatNode] clear failed', res.status);
      } else {
        console.debug('[ChatNode] clear ok', { nodeId });
        setLocalHistory([]);
        window.dispatchEvent(new Event('graph:refresh-request'));
      }
    } catch(e){ console.warn('[ChatNode] clear error', e); }
    finally { setClearing(false); }
  }, [clearing, saving, localHistory.length, rawProps, nodeId]);

  const handleSize = 10;
  const commonHandle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    borderRadius: handleSize/2,
    border: '1px solid #3a3f45'
  };
  return (
    <div style={{ padding:'6px 6px 10px', border:'1px solid #4a5560', borderRadius:4, background:'#1f262d', color:'#eee', fontSize:11, minWidth:180, width:220, display:'flex', flexDirection:'column', position:'relative' }}>
      {/* Target (incoming) handle */}
      <Handle data-testid={`chat-handle-target-${nodeId}`} type="target" position={Position.Top} style={{ ...commonHandle, background:'#888', transform:'translate(-50%, -55%)' }} />
      <div style={{ fontWeight:600, fontSize:12, marginBottom:4, textAlign:'center' }}>{data?.label || 'Chat'}</div>
      <div ref={scrollRef} style={{ flex:'0 0 140px', overflowY:'auto', background:'#141a1f', border:'1px solid #2c3740', padding:4, borderRadius:3, display:'flex', flexDirection:'column', gap:4 }}>
        {localHistory.length === 0 && <div style={{ opacity:0.5, fontStyle:'italic' }}>No messages</div>}
        {localHistory.map(m => (
          <div key={m.id} style={{ background:'#222b33', padding:'4px 6px', borderRadius:3, lineHeight:1.25 }}>
            <div style={{ fontSize:9, opacity:0.6, display:'flex', justifyContent:'space-between' }}>
              <span>{m.role}</span>
              <span>{new Date(m.ts).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{m.content}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
        <textarea
          data-testid={`chat-composer-${nodeId}`}
          value={composer}
          onChange={e=>setComposer(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Type a message"
          style={{ width:'100%', fontFamily:'inherit', fontSize:'inherit', resize:'none', background:'#151c22', color:'#eee', border:'1px solid #2c3740', padding:4, borderRadius:3 }}
        />
        <div style={{ display:'flex', gap:6 }}>
          <button
            data-testid={`chat-send-${nodeId}`}
            onClick={onSend}
            disabled={!composer.trim() || saving}
            style={{ flex:1, background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'4px 6px', cursor:(!composer.trim()||saving)?'default':'pointer', borderRadius:3, fontSize:11 }}>
            {saving? 'Saving…' : 'Send'}
          </button>
          <button
            data-testid={`chat-clear-${nodeId}`}
            onClick={onClear}
            disabled={clearing || saving || localHistory.length === 0}
            style={{ width:60, background:'#3a2f2f', color:'#fff', border:'1px solid #513b3b', padding:'4px 6px', cursor:(clearing||saving||localHistory.length===0)?'default':'pointer', borderRadius:3, fontSize:11, opacity: localHistory.length===0?0.5:1 }}>
            {clearing? '...' : 'Clear'}
          </button>
        </div>
      </div>
      {/* Source (outgoing) handle */}
      <Handle data-testid={`chat-handle-source-${nodeId}`} type="source" position={Position.Bottom} style={{ ...commonHandle, background:'#3d8', transform:'translate(-50%, 55%)' }} />
    </div>
  );
};

export default ChatNode;
