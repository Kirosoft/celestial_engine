import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface UIStateSnapshot {
  selectedNodeIds: string[];
  selectedNodeId?: string; // convenience: first selected or undefined
  selectedEdgeId?: string;
  selectionAction?: number; // increments on any selection change for effects
  showInspector: boolean;
  showToolbox: boolean;
}

interface UIStateContextValue extends UIStateSnapshot {
  setSelectedNodeIds(ids: string[]): void;
  setSelectedEdge(id: string | undefined): void;
  toggleInspector(force?: boolean): void;
  toggleToolbox(force?: boolean): void;
  clearSelection(): void;
}

const UIStateContext = createContext<UIStateContextValue | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>(undefined);
  const [selectionAction, setSelectionAction] = useState<number>(0);
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [showToolbox, setShowToolbox] = useState<boolean>(true);

  const setSelected = useCallback((ids: string[]) => {
    setSelectedNodeIds(ids);
    // Clear edge selection when node selection changes
    setSelectedEdgeId(undefined);
    setSelectionAction(a=>a+1);
  }, []);
  const setSelectedEdge = useCallback((id: string | undefined) => {
    setSelectedEdgeId(id);
    if(id){
      // Clear node selection when selecting an edge
      setSelectedNodeIds([]);
    }
    setSelectionAction(a=>a+1);
  }, []);

  const toggleInspector = useCallback((force?: boolean) => {
    setShowInspector(v => (typeof force === 'boolean' ? force : !v));
  }, []);

  const toggleToolbox = useCallback((force?: boolean) => {
    setShowToolbox(v => (typeof force === 'boolean' ? force : !v));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), [setSelected]);

  const value: UIStateContextValue = {
    selectedNodeIds,
    selectedNodeId: selectedNodeIds[0],
    selectedEdgeId,
    selectionAction,
    showInspector,
    showToolbox,
    setSelectedNodeIds: setSelected,
    setSelectedEdge,
    toggleInspector,
    toggleToolbox,
    clearSelection
  };
  if(typeof window !== 'undefined'){
    (window as any).__selectNode = (id: string) => setSelected([id]);
  }
  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIState(){
  const ctx = useContext(UIStateContext);
  if(!ctx) throw new Error('useUIState must be used within UIStateProvider');
  return ctx;
}
