import { useEffect, useState, useCallback } from 'react';
import { useUIState } from '../state/uiState';
import { applyNodeChanges, type Node as RFNode, type Edge as RFEdge, type NodeChange } from 'reactflow';
import { NodeFile } from '../types/nodes';

interface ApiNodeList { nodes: NodeFile[] }

export function useGraphData(){
  const [nodes, setNodes] = useState<RFNode[]>([]);
  const [edges, setEdges] = useState<RFEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error|undefined>();
  // Track if viewing a group subgraph
  let currentGroupId: string | undefined;
  try {
    // Hook may be used inside UIStateProvider only; guard in case
    const ui = useUIState();
    currentGroupId = ui.currentGroupId;
  } catch {/* ignore if context absent */}

  const transform = useCallback((api: ApiNodeList)=>{
  const rfNodesRaw: RFNode[] = api.nodes.map(n=>{
    if(n.type === 'ChatNode'){
      return { id: n.id, type: 'chatNode', position: n.position || { x:0, y:0 }, data: { label: n.name || n.id, type: n.type, nodeId: n.id, history: (n as any).props?.history || [], maxEntries: (n as any).props?.maxEntries, rawProps: (n as any).props } } as RFNode;
    }
    return { id: n.id, type: 'basicNode', position: n.position || { x: 0, y: 0 }, data: { label: n.name || n.id, type: n.type, nodeId: n.id } } as RFNode;
  });
  if(process.env.NODE_ENV !== 'production'){
    const ids = rfNodesRaw.map(n=>n.id);
    const dupeMap = new Map<string, number>();
    ids.forEach(i=> dupeMap.set(i, (dupeMap.get(i)||0)+1));
    const dupes = [...dupeMap.entries()].filter(([,c])=>c>1).map(([i,c])=>`${i}(${c})`);
    if(dupes.length){
      console.warn('[useGraphData][transform] duplicate ids before dedupe:', dupes.join(', '));
    } else {
      console.debug('[useGraphData][transform] node ids:', ids.join(', '));
    }
  }
  // Dedupe by id, keep first occurrence; log warning for duplicates
  const seen = new Set<string>();
  const rfNodes: RFNode[] = [];
  for(const n of rfNodesRaw){
    if(seen.has(n.id)){
      console.warn('[useGraphData] duplicate node id encountered, dropping duplicate', n.id);
      continue;
    }
    seen.add(n.id);
    rfNodes.push(n);
  }
    const rfEdges: RFEdge[] = [];
    for(const n of api.nodes){
      if(n.edges?.out){
        for(const e of n.edges.out){
          rfEdges.push({ id: `${n.id}:${e.id}`, source: n.id, target: e.targetId, data: { kind: e.kind }, type: 'default' });
        }
      }
    }
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, []);

  const load = useCallback(async ()=>{
    setLoading(true); setError(undefined);
    try {
      const url = currentGroupId ? `/api/groups/${currentGroupId}/subgraph` : '/api/nodes';
      const res = await fetch(url);
      if(!res.ok) throw new Error('Failed to load nodes');
      const json = await res.json();
      if(currentGroupId){
        const sg = json as { nodes: any[]; edges: any[] };
        // Map proxy node types differently for style hints via data.type
        const rfNodesRaw: RFNode[] = sg.nodes.map(n=>{
          if(n.type === 'ChatNode'){
            return { id: n.id, type: 'chatNode', position: n.position || { x:0, y:0 }, data: { label: n.name || n.id, type: n.type, nodeId: n.id, history: (n as any).props?.history || [], maxEntries: (n as any).props?.maxEntries, rawProps: (n as any).props } } as RFNode;
          }
          return { id: n.id, type: 'basicNode', position: n.position || { x:0, y:0 }, data: { label: n.name || n.id, type: n.type, nodeId: n.id, __proxy: n.type?.startsWith('GroupInputProxy') || n.type?.startsWith('GroupOutputProxy') } } as RFNode;
        });
        if(process.env.NODE_ENV !== 'production'){
          const ids = rfNodesRaw.map(n=>n.id);
          const dupeMap = new Map<string, number>();
          ids.forEach(i=> dupeMap.set(i, (dupeMap.get(i)||0)+1));
          const dupes = [...dupeMap.entries()].filter(([,c])=>c>1).map(([i,c])=>`${i}(${c})`);
          if(dupes.length){
            console.warn('[useGraphData][subgraph] duplicate ids before dedupe:', dupes.join(', '));
          } else {
            console.debug('[useGraphData][subgraph] node ids:', ids.join(', '));
          }
        }
        const seen = new Set<string>();
        const rfNodes: RFNode[] = [];
        for(const n of rfNodesRaw){
          if(seen.has(n.id)){
            console.warn('[useGraphData] duplicate node id in subgraph, dropping duplicate', n.id);
            continue;
          }
          seen.add(n.id); rfNodes.push(n);
        }
        const rfEdges: RFEdge[] = (sg.edges||[]).map(e=>({ id: `${e.sourceId}:${e.id}`, source: e.sourceId, target: e.targetId, data:{ kind: e.kind }, type:'default' }));
        setNodes(rfNodes); setEdges(rfEdges);
      } else {
        transform(json as ApiNodeList);
      }
    } catch(e: any){ setError(e); }
    finally { setLoading(false); }
  }, [transform, currentGroupId]);

  useEffect(()=>{ load(); }, [load, currentGroupId]);
  // Listen for external refresh requests (e.g., toolbox create)
  useEffect(()=>{
    const h = () => load();
    window.addEventListener('graph:refresh-request', h);
    window.addEventListener('graph:group-enter', h as any);
    window.addEventListener('graph:group-exit', h as any);
    return () => {
      window.removeEventListener('graph:refresh-request', h);
      window.removeEventListener('graph:group-enter', h as any);
      window.removeEventListener('graph:group-exit', h as any);
    };
  }, [load]);
  // Listen for node label updates (rename) to update UI instantly without full reload
  useEffect(()=>{
    function onLabelUpdate(e: any){
      const detail = e.detail as { id: string; name: string } | undefined;
      if(!detail) return;
      setNodes(nds => nds.map(n => n.id === detail.id ? { ...n, data: { ...n.data, label: detail.name } } : n));
    }
    window.addEventListener('graph:update-node-label', onLabelUpdate as any);
    return () => window.removeEventListener('graph:update-node-label', onLabelUpdate as any);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const persistPosition = useCallback(async (id: string, x: number, y: number) => {
    try {
      // Use group-scoped position endpoint only for true subgraph nodes (never for the group root itself).
      // If the node id matches the current group id, it's the group root (visible only at root canvas) and should
      // use the root /api/nodes/:id/position endpoint. Defensive guard also covers cases where a group was created
      // while inside another group context or selection side-effects.
      if(currentGroupId && id === currentGroupId){
        // Skip: group root is not a subgraph node; attempting group-scoped position causes 404.
        // We also avoid a duplicate root call because initial placement rarely changes immediately on creation.
        return;
      }
      const useGroupScoped = !!currentGroupId && id !== currentGroupId;
      const url = useGroupScoped ? `/api/groups/${currentGroupId}/nodes/${id}/position` : `/api/nodes/${id}/position`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ x, y }) });
      if(!res.ok){
        console.warn('[persistPosition] failed', id, x, y, res.status);
      }
    } catch(e){
      console.warn('[persistPosition] error', e);
    }
  }, [currentGroupId]);

  const addEdgeLocal = useCallback(async (sourceId: string, targetId: string, kind: 'flow'|'data'='flow') => {
    try {
      const url = currentGroupId ? `/api/groups/${currentGroupId}/edges` : '/api/edges';
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ sourceId, targetId, kind }) });
      if(!res.ok){
        return false;
      }
      const json = await res.json() as { edge: { id: string; kind: string } };
      setEdges(edgs => [...edgs, { id: `${sourceId}:${json.edge.id}`, source: sourceId, target: targetId, data: { kind: json.edge.kind }, type: 'default' }]);
      return true;
    } catch(e){
      console.warn('[addEdgeLocal] error', e);
      return false;
    }
  }, [currentGroupId]);

  // Allow tests (and potential future UI components) to create edges without drag interaction.
  useEffect(()=>{
    function onCreateEdge(ev: any){
      const detail = ev?.detail || {};
      const { source, target, kind } = detail;
      if(source && target){
        addEdgeLocal(source, target, kind || 'flow');
      }
    }
    window.addEventListener('graph:create-edge', onCreateEdge as any);
    return ()=> window.removeEventListener('graph:create-edge', onCreateEdge as any);
  }, [addEdgeLocal]);

  return { nodes, edges, loading, error, refresh: load, onNodesChange, persistPosition, addEdgeLocal };
}
