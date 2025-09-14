import React, { useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, NodeDragHandler, OnSelectionChangeParams } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphData } from '../hooks/useGraphData';
import { useUIState } from '../state/uiState';

export function Canvas(){
  const { nodes, edges, refresh, loading, error, onNodesChange, persistPosition } = useGraphData();
  const { setSelectedNodeIds } = useUIState();
  const onPaneClick = useCallback(()=>{/* selection clear placeholder */}, []);
  const onNodeDragStop: NodeDragHandler = useCallback((_e, node: Node)=>{
    if(node && node.position){
      persistPosition(node.id, node.position.x, node.position.y);
    }
  }, [persistPosition]);
  const onSelectionChange = useCallback((params: OnSelectionChangeParams)=>{
    const ids = params.nodes.map(n=>n.id);
    setSelectedNodeIds(ids);
  }, [setSelectedNodeIds]);
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      {loading && <div style={{ position:'absolute', top:8, left:8, background:'#222', color:'#fff', padding:'4px 8px', borderRadius:4 }}>Loading…</div>}
      {error && <div style={{ position:'absolute', top:8, left:8, background:'#b00', color:'#fff', padding:'4px 8px', borderRadius:4 }}>Error loading graph</div>}
      {!loading && !error && nodes.length === 0 && (
        <div style={{ position:'absolute', top:50, left:50, background:'#333', color:'#ddd', padding:'10px 14px', borderRadius:6, fontSize:14, maxWidth:320 }}>
          No nodes found.<br/>
          Start the dev server with the repository root set via <code>REPO_ROOT</code> to load existing graph data,<br/> or create a new node (toolbox coming soon).
        </div>
      )}
      <ReactFlow nodes={nodes} edges={edges} onPaneClick={onPaneClick} onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} onSelectionChange={onSelectionChange} fitView>
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
      <SelectionBadge />
      <button style={{ position:'absolute', bottom:10, right:10 }} onClick={refresh}>Reload</button>
    </div>
  );
}

function SelectionBadge(){
  const { selectedNodeIds } = useUIState();
  if(!selectedNodeIds.length) return null;
  return (
    <div style={{ position:'absolute', top:8, right:8, background:'#1b2733', color:'#fff', padding:'4px 8px', borderRadius:4, fontSize:12 }}>
      {selectedNodeIds.length === 1 ? `Selected: ${selectedNodeIds[0]}` : `${selectedNodeIds.length} nodes selected`}
    </div>
  );
}
