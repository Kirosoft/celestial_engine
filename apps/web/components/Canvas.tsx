import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, NodeDragHandler, OnSelectionChangeParams, Connection, Handle, Position, Edge as RFEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphData } from '../hooks/useGraphData';
import { useUIState } from '../state/uiState';

export function Canvas(){
  const { nodes, edges, refresh, loading, error, onNodesChange, persistPosition, addEdgeLocal } = useGraphData();
  const { setSelectedNodeIds, setSelectedEdge, selectedNodeIds, selectedEdgeId } = useUIState() as any;
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
    if(ids.length){
      setSelectedNodeIds(ids);
    }
  }, [setSelectedNodeIds]);
  const onEdgeClick = useCallback((_e: any, edge: RFEdge)=>{
    setSelectedEdge(edge.id);
  }, [setSelectedEdge]);
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

  // Delete key handling
  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      const target = e.target as HTMLElement | null;
      if(target){
        const tag = target.tagName;
        const editable = target.getAttribute('contenteditable');
        if(editable === 'true' || ['INPUT','TEXTAREA','SELECT'].includes(tag)){
          return; // Don't treat Delete/Backspace inside editable fields as graph deletion
        }
      }
      if(e.key === 'Delete' || e.key === 'Backspace'){
        if(selectedNodeIds && selectedNodeIds.length === 1){
          const id = selectedNodeIds[0];
          (async()=>{
            try {
              const res = await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
              if(res.ok){
                refresh();
                setSelectedNodeIds([]);
              }
            } catch(err){ console.warn('[delete node] error', err); }
          })();
        } else if(selectedEdgeId){
          // edge id pattern: sourceId:edgeId
            const parts = selectedEdgeId.split(':');
            if(parts.length === 2){
              const sourceId = parts[0];
              const edgeId = parts[1];
              (async()=>{
                try {
                  const res = await fetch(`/api/edges/${sourceId}/${edgeId}`, { method: 'DELETE' });
                  if(res.ok){
                    refresh();
                    setSelectedEdge(undefined);
                  }
                } catch(err){ console.warn('[delete edge] error', err); }
              })();
            }
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [selectedNodeIds, selectedEdgeId, refresh, setSelectedNodeIds, setSelectedEdge]);
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
        nodeTypes={nodeTypes}
        onPaneClick={onPaneClick}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onEdgeClick={onEdgeClick}
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
  const label = data?.label || data?.type || 'node';
  const handleSize = 10; // smaller connectors
  const commonHandle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    borderRadius: handleSize/2,
    border: '1px solid #3a3f45'
  };
  return (
    <div style={{ padding:'8px 6px', paddingTop:12, border:'1px solid #4a5560', borderRadius:4, background:'#222', color:'#eee', fontSize:12, minWidth:120, textAlign:'center', lineHeight:1.2 }}>
      {/* Target (incoming) handle - lifted slightly so it doesn't overlap text */}
	<Handle data-testid="handle-target" type="target" position={Position.Top} style={{ ...commonHandle, background:'#888', transform:'translate(-50%, -55%)' }} />
      <div style={{ pointerEvents:'none', fontWeight:500, padding:'0 2px' }}>{label}</div>
	<Handle data-testid="handle-source" type="source" position={Position.Bottom} style={{ ...commonHandle, background:'#3d8', transform:'translate(-50%, 55%)' }} />
    </div>
  );
};

// Stable nodeTypes object to avoid React Flow warning #002 about recreating node/edge type maps every render.
const nodeTypes = { basicNode: BasicNode } as const;
