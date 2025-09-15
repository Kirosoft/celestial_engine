import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, NodeDragHandler, OnSelectionChangeParams, Connection, Handle, Position, Edge as RFEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphData } from '../hooks/useGraphData';
import { useUIState } from '../state/uiState';

export function Canvas(){
  const { nodes, edges, refresh, loading, error, onNodesChange, persistPosition, addEdgeLocal } = useGraphData();
  const { setSelectedNodeIds, setSelectedEdge, selectedNodeIds, selectedEdgeId, currentGroupId, exitGroup } = useUIState() as any;
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

  // Delete / Escape key handling
  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      // Escape should always exit group context, even if focus inside input/select
      if(e.key === 'Escape' && currentGroupId){
        exitGroup();
        return;
      }
      const target = e.target as HTMLElement | null;
      // For delete/backspace we still skip if typing in inputs
      if(target){
        const tag = target.tagName;
        const editable = target.getAttribute('contenteditable');
        if(editable === 'true' || ['INPUT','TEXTAREA','SELECT'].includes(tag)){
          return;
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
          const parts = selectedEdgeId.split(':');
          if(parts.length === 2){
            const sourceId = parts[0];
            const edgeId = parts[1];
            (async()=>{
              try {
                // For subgroup edges, we don't know the source id in API path; edge id alone is enough with group endpoint
                const url = currentGroupId ? `/api/groups/${currentGroupId}/edges/${edgeId}` : `/api/edges/${sourceId}/${edgeId}`;
                const res = await fetch(url, { method: 'DELETE' });
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
  }, [selectedNodeIds, selectedEdgeId, refresh, setSelectedNodeIds, setSelectedEdge, currentGroupId, exitGroup]);
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      {loading && <div style={{ position:'absolute', top:8, left:8, background:'#222', color:'#fff', padding:'4px 8px', borderRadius:4 }}>Loading…</div>}
  {error && <ErrorBanner hasGroup={!!currentGroupId} />}
      {!loading && !error && nodes.length === 0 && (
        <div style={{ position:'absolute', top:50, left:50, background:'#333', color:'#ddd', padding:'10px 14px', borderRadius:6, fontSize:14, maxWidth:320 }}>
          No nodes found.<br/>
          Start the dev server with the repository root set via <code>REPO_ROOT</code> to load existing graph data,<br/> or create a new node (toolbox coming soon).
        </div>
      )}
      {currentGroupId && (
        <div style={{ position:'absolute', top:4, left:8, zIndex:30, display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={()=>exitGroup()} style={{ background:'#2f3d4a', color:'#fff', border:'1px solid #3d4d5c', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontSize:12 }}>
            ← Back to Root
          </button>
          <div style={{ fontSize:12, color:'#ccc' }}>Inside Group: <code>{currentGroupId}</code> <span style={{ color:'#888' }}>— edges & editing limited</span></div>
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
  const nodeId = data?.nodeId || data?.id || label; // ensure we have canonical id
  const handleSize = 10; // smaller connectors
  const commonHandle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    borderRadius: handleSize/2,
    border: '1px solid #3a3f45'
  };
  const isGroup = data?.type === 'Group';
  const isProxy = data?.__proxy;
  const { enterGroup } = useUIState() as any;
  return (
    <div style={{ padding:'8px 6px', paddingTop:12, border:'1px solid '+(isGroup?'#5c7fff': isProxy? '#888':'#4a5560'), borderRadius:4, background: isGroup ? '#1e2b40' : isProxy ? '#262626' : '#222', color:'#eee', fontSize:12, minWidth: isProxy?80:120, textAlign:'center', lineHeight:1.2, position:'relative' }}>
	<Handle data-testid="handle-target" type="target" position={Position.Top} style={{ ...commonHandle, background:'#888', transform:'translate(-50%, -55%)' }} />
      <div style={{ pointerEvents:'none', fontWeight:500, padding:'0 2px' }}>{label}</div>
	{!isProxy && <Handle data-testid="handle-source" type="source" position={Position.Bottom} style={{ ...commonHandle, background:'#3d8', transform:'translate(-50%, 55%)' }} />}
    {isProxy && <Handle data-testid="handle-source" type="source" position={Position.Bottom} style={{ ...commonHandle, background: data?.type?.includes('Input') ? '#3d8' : '#d83', transform:'translate(-50%, 55%)' }} />}
    {isGroup && (
  <button onClick={()=>enterGroup(nodeId)} style={{ position:'absolute', top:-10, right:-10, background:'#2f3d4a', border:'1px solid #3d4d5c', color:'#fff', fontSize:10, padding:'2px 4px', borderRadius:4, cursor:'pointer' }}>Expand</button>
    )}
    </div>
  );
};

// Stable nodeTypes object to avoid React Flow warning #002 about recreating node/edge type maps every render.
const nodeTypes = { basicNode: BasicNode } as const;

function ErrorBanner({ hasGroup }: { hasGroup: boolean }){
  const top = hasGroup ? 40 : 8; // leave room for Back button row
  return (
    <div style={{ position:'absolute', top, left:8, background:'#b00', color:'#fff', padding:'4px 8px', borderRadius:4, zIndex:40 }}>
      Error loading graph
    </div>
  );
}
