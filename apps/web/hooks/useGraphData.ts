import { useEffect, useState, useCallback } from 'react';
import { applyNodeChanges, type Node as RFNode, type Edge as RFEdge, type NodeChange } from 'reactflow';
import { NodeFile } from '../types/nodes';

interface ApiNodeList { nodes: NodeFile[] }

export function useGraphData(){
  const [nodes, setNodes] = useState<RFNode[]>([]);
  const [edges, setEdges] = useState<RFEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error|undefined>();

  const transform = useCallback((api: ApiNodeList)=>{
    const rfNodes: RFNode[] = api.nodes.map(n=>({ id: n.id, position: n.position || { x: 0, y: 0 }, data: { label: n.name || n.id, type: n.type } }));
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
      const res = await fetch('/api/nodes');
      if(!res.ok) throw new Error('Failed to load nodes');
      const json = await res.json();
      transform(json as ApiNodeList);
    } catch(e: any){ setError(e); }
    finally { setLoading(false); }
  }, [transform]);

  useEffect(()=>{ load(); }, [load]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const persistPosition = useCallback(async (id: string, x: number, y: number) => {
    try {
      const res = await fetch(`/api/nodes/${id}/position`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ x, y }) });
      if(!res.ok){
        console.warn('[persistPosition] failed', id, x, y, res.status);
      }
    } catch(e){
      console.warn('[persistPosition] error', e);
    }
  }, []);

  return { nodes, edges, loading, error, refresh: load, onNodesChange, persistPosition };
}
