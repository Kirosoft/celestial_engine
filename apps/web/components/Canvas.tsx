import React, { useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, NodeDragHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphData } from '../hooks/useGraphData';

export function Canvas(){
  const { nodes, edges, refresh, loading, error, onNodesChange, persistPosition } = useGraphData();
  const onPaneClick = useCallback(()=>{/* selection clear placeholder */}, []);
  const onNodeDragStop: NodeDragHandler = useCallback((_e, node: Node)=>{
    if(node && node.position){
      persistPosition(node.id, node.position.x, node.position.y);
    }
  }, [persistPosition]);
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      {loading && <div style={{ position:'absolute', top:8, left:8, background:'#222', color:'#fff', padding:'4px 8px', borderRadius:4 }}>Loading…</div>}
      {error && <div style={{ position:'absolute', top:8, left:8, background:'#b00', color:'#fff', padding:'4px 8px', borderRadius:4 }}>Error loading graph</div>}
      <ReactFlow nodes={nodes} edges={edges} onPaneClick={onPaneClick} onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} fitView>
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
      <button style={{ position:'absolute', bottom:10, right:10 }} onClick={refresh}>Reload</button>
    </div>
  );
}
