import React from 'react';
import dynamic from 'next/dynamic';
import { UIStateProvider } from '../state/uiState';
import { Toolbox } from '../components/Toolbox';
import { Inspector } from '../components/Inspector';

const Canvas = dynamic(()=>import('../components/Canvas').then(m=>m.Canvas), { ssr: false });

export default function Home() {
  return (
    <UIStateProvider>
      <div style={{ width:'100vw', height:'100vh', overflow:'hidden' }}>
        <Canvas />
        <Toolbox />
        <Inspector />
      </div>
    </UIStateProvider>
  );
}
