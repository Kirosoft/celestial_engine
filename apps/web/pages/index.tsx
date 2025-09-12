import React from 'react';
import dynamic from 'next/dynamic';

const Canvas = dynamic(()=>import('../components/Canvas').then(m=>m.Canvas), { ssr: false });

export default function Home(){
  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden' }}>
      <Canvas />
    </div>
  );
}
