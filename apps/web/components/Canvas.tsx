import React, { useCallback, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, NodeDragHandler, OnSelectionChangeParams, Connection, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphData } from '../hooks/useGraphData';
import { useUIState } from '../state/uiState';

export function Canvas(){
  const { nodes, edges, refresh, loading, error, onNodesChange, persistPosition, addEdgeLocal } = useGraphData();
  const { setSelectedNodeIds } = useUIState();
  const [edgeError, setEdgeError] = useState<string|undefined>();
  const onPaneClick = useCallback(()=>{/* selection clear placeholder */}, []);
  const onNodeDragStop: NodeDragHandler = useCallback((_e, node: Node)=>{
    if(node && node.position){
  console.log('[onNodeDragStop]', node.id, node.position);
  persistPosition(node.id, node.position.x, node.position.y);
    }
  }, [persistPosition]);
  const onSelectionChange = useCallback((params: OnSelectionChangeParams)=>{
    const ids = params.nodes.map(n=>n.id);
    setSelectedNodeIds(ids);
  }, [setSelectedNodeIds]);
  const onConnect = useCallback((connection: Connection)=>{
    if(!connection.source || !connection.target) return;
    (async()=>{
      const ok = await addEdgeLocal(connection.source!, connection.target!);
      if(!ok){
        setEdgeError('Edge creation failed');
        setTimeout(()=> setEdgeError(undefined), 3000);
      }
    })();
  }, [addEdgeLocal]);
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
      <ReactFlow 
  nodes={nodes}
        edges={edges}
        nodeTypes={{ basicNode: BasicNode }}
        onPaneClick={onPaneClick}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        fitView>
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
      <SelectionBadge />
      {edgeError && <div style={{ position:'absolute', bottom:50, right:10, background:'#b33', color:'#fff', padding:'6px 10px', borderRadius:4, fontSize:12 }}>{edgeError}</div>}
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

// Basic node renderer with source (bottom) and target (top) handles
const BasicNode: React.FC<any> = ({ data }) => {
  return (
    <div style={{ padding:6, border:'1px solid #555', borderRadius:4, background:'#222', color:'#eee', fontSize:12, minWidth:120, textAlign:'center' }}>
  <Handle data-testid="handle-target" type="target" position={Position.Top} style={{ background:'#888', width:16, height:16, borderRadius:8, border:'2px solid #444' }} />
      <div>{data?.label || data?.type || 'node'}</div>
  <Handle data-testid="handle-source" type="source" position={Position.Bottom} style={{ background:'#4a8', width:16, height:16, borderRadius:8, border:'2px solid #2d5' }} />
    </div>
  );
};
