export interface EdgeOut { id: string; targetId: string; kind: 'flow'|'data'; sourcePort?: string; targetPort?: string }
export interface NodeFile { id: string; type: string; name: string; position?: { x: number; y: number }; props?: any; edges?: { out: EdgeOut[] } }
