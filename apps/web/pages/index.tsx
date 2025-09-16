import React from 'react';
import dynamic from 'next/dynamic';
import { UIStateProvider, useUIState } from '../state/uiState';
import { Toolbox } from '../components/Toolbox';
import { Inspector } from '../components/Inspector';
import { SystemSettingsPanel } from '../components/SystemSettingsPanel';

const Canvas = dynamic(()=>import('../components/Canvas').then(m=>m.Canvas), { ssr: false });

function FloatingInspectorButton(){
  const { showInspector, toggleInspector } = useUIState();
  if(showInspector) return null;
  return (
    <button
      data-testid="open-inspector"
      onClick={()=>toggleInspector(true)}
      style={{
        position:'absolute',
        right:16,
        top:16,
        background:'#2f3d4a',
        color:'#fff',
        border:'1px solid #3d4d5c',
        padding:'6px 10px',
        borderRadius:4,
        cursor:'pointer',
        fontSize:12,
        zIndex:30
      }}
    >Open Inspector</button>
  );
}

export default function Home() {
  return (
    <UIStateProvider>
      <div style={{ width:'100vw', height:'100vh', overflow:'hidden' }}>
        <Canvas />
        <Toolbox />
        <Inspector />
  <SystemSettingsPanel />
        <FloatingInspectorButton />
      </div>
    </UIStateProvider>
  );
}
