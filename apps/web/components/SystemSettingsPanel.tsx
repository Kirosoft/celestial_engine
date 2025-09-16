import React, { useEffect, useState, useCallback } from 'react';
import { useUIState } from '../state/uiState';

interface EditableSettings {
  llm: { baseUrl: string; apiKey: string; defaultModel: string; timeoutMs: number; useStreaming: boolean };
  logging: { level: string };
  features: { enableExperimental: boolean };
  masked?: boolean;
}

export function SystemSettingsPanel(){
  const { showSettings, toggleSettings } = useUIState() as any;
  const [data, setData] = useState<EditableSettings|null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [reveal, setReveal] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (opts?: { reveal?: boolean }) => {
    setLoading(true); setError(undefined);
    try {
      const url = '/api/system' + (opts?.reveal ? '?reveal=1' : '');
      const res = await fetch(url);
      if(!res.ok) throw new Error('Failed to load settings');
      const json = await res.json();
      setData(json);
      setDirty(false);
    } catch(e:any){ setError(e.message || 'Error'); }
    finally{ setLoading(false); }
  }, []);

  useEffect(()=>{ if(showSettings) load(); }, [showSettings, load]);

  const updateField = (path: string, value: any) => {
    setData(prev => {
      if(!prev) return prev;
      const clone: any = { ...prev, llm: { ...prev.llm }, logging: { ...prev.logging }, features: { ...prev.features } };
      const segs = path.split('.');
      let cur: any = clone;
      for(let i=0;i<segs.length-1;i++){ cur = cur[segs[i]]; }
      cur[segs[segs.length-1]] = value;
      return clone;
    });
    setDirty(true);
  };

  const onSave = async () => {
    if(!data) return; setSaving(true); setError(undefined);
    try {
      const payload = { 
        llm: { ...data.llm, apiKey: reveal ? data.llm.apiKey : (data.llm.apiKey === '***' ? undefined : data.llm.apiKey) },
        logging: { ...data.logging },
        features: { ...data.features }
      };
      // Remove undefined apiKey to avoid clearing existing secret if unchanged
      if(payload.llm.apiKey === undefined) delete (payload.llm as any).apiKey;
      const res = await fetch('/api/system', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if(!res.ok){
        const j = await res.json().catch(()=>({}));
        throw new Error(j.message || 'Save failed');
      }
      await load();
    } catch(e:any){ setError(e.message || 'Save error'); }
    finally { setSaving(false); }
  };

  useEffect(()=>{
    if(showSettings){
      // Focus first field after open
      setTimeout(()=>{
        const el = document.querySelector('[data-testid="settings-baseUrl"]') as HTMLInputElement | null;
        el?.focus();
      }, 0);
    }
  }, [showSettings]);

  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      if(e.key === 'Escape' && showSettings){
        toggleSettings(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [showSettings, toggleSettings]);

  if(!showSettings) return null;
  return (
    <div style={panelWrap} role="dialog" aria-modal="true" aria-label="System Settings">
      <div style={panel}>
        <div style={header}>
          <strong>System Settings</strong>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>load()} disabled={loading || saving} style={smallBtn}>Reload</button>
            <button onClick={()=>toggleSettings(false)} style={smallBtn} aria-label="Close settings">×</button>
          </div>
        </div>
        {error && <div style={errStyle}>{error}</div>}
        {loading && <div style={dim}>Loading…</div>}
        {!loading && data && (
          <form onSubmit={e=>{e.preventDefault(); onSave();}} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <fieldset style={fs}><legend style={lg}>LLM</legend>
              <label style={lbl}>Base URL
                <input data-testid="settings-baseUrl" type="text" value={data.llm.baseUrl} onChange={e=>updateField('llm.baseUrl', e.target.value)} style={inp} />
              </label>
              <label style={lbl}>API Key
                <div style={{ display:'flex', gap:4 }}>
                  <input data-testid="settings-apiKey" type={reveal ? 'text':'password'} value={data.llm.apiKey} onChange={e=>{ updateField('llm.apiKey', e.target.value); }} style={{ ...inp, flex:1 }} />
                  <button type="button" onClick={async ()=>{ const next = !reveal; setReveal(next); if(next) await load({ reveal:true }); }} style={smallBtn}>{reveal ? 'Hide':'Reveal'}</button>
                </div>
              </label>
              <label style={lbl}>Default Model
                <input data-testid="settings-defaultModel" type="text" value={data.llm.defaultModel} onChange={e=>updateField('llm.defaultModel', e.target.value)} style={inp} />
              </label>
              <label style={lbl}>Timeout (ms)
                <input data-testid="settings-timeoutMs" type="number" min={1000} value={data.llm.timeoutMs} onChange={e=>updateField('llm.timeoutMs', Number(e.target.value))} style={inp} />
              </label>
              <label style={chkLbl}>
                <input data-testid="settings-useStreaming" type="checkbox" checked={data.llm.useStreaming} onChange={e=>updateField('llm.useStreaming', e.target.checked)} /> Use Streaming
              </label>
            </fieldset>
            <fieldset style={fs}><legend style={lg}>Logging</legend>
              <label style={lbl}>Level
                <select data-testid="settings-logging-level" value={data.logging.level} onChange={e=>updateField('logging.level', e.target.value)} style={inp}>
                  {['debug','info','warn','error'].map(l=> <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
            </fieldset>
            <fieldset style={fs}><legend style={lg}>Features</legend>
              <label style={chkLbl}>
                <input data-testid="settings-enableExperimental" type="checkbox" checked={data.features.enableExperimental} onChange={e=>updateField('features.enableExperimental', e.target.checked)} /> Enable Experimental
              </label>
            </fieldset>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button type="submit" disabled={!dirty || saving} style={primaryBtn}>{saving ? 'Saving…':'Save'}</button>
              <button type="button" disabled={saving} onClick={()=>toggleSettings(false)} style={smallBtn}>Close</button>
            </div>
            <div style={{ fontSize:11, color:'#777' }}>Changes apply to future executions. Node-level props still override global defaults.</div>
          </form>
        )}
      </div>
    </div>
  );
}

const panelWrap: React.CSSProperties = { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:20 };
const panel: React.CSSProperties = { width:420, maxHeight:'100%', overflowY:'auto', background:'#1f2530', border:'1px solid #39424f', borderRadius:8, padding:18, color:'#eee', boxShadow:'0 2px 8px rgba(0,0,0,0.5)', fontSize:13 };
const header: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 };
const fs: React.CSSProperties = { border:'1px solid #2f3a47', padding:10, borderRadius:6 };
const lg: React.CSSProperties = { padding:'0 6px', fontSize:12 };
const lbl: React.CSSProperties = { display:'flex', flexDirection:'column', gap:4, marginBottom:8 };
const chkLbl: React.CSSProperties = { display:'flex', alignItems:'center', gap:6, fontSize:12, marginBottom:6 };
const inp: React.CSSProperties = { background:'#2a333f', border:'1px solid #3a4654', color:'#fff', padding:'4px 6px', borderRadius:4, fontSize:12 };
const smallBtn: React.CSSProperties = { background:'#2f3d4a', border:'1px solid #3d4d5c', color:'#fff', padding:'4px 8px', cursor:'pointer', borderRadius:4, fontSize:12 };
const primaryBtn: React.CSSProperties = { ...smallBtn, background:'#3566d6', border:'1px solid #4073e4' };
const dim: React.CSSProperties = { fontSize:12, color:'#9aa' };
const errStyle: React.CSSProperties = { background:'#4d1f1f', border:'1px solid #7a2e2e', padding:8, borderRadius:4, color:'#f88', fontSize:12, marginBottom:10 };
