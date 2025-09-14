import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface UIStateSnapshot {
  selectedNodeIds: string[];
  selectedNodeId?: string; // convenience: first selected or undefined
  selectionAction?: number; // increments on any selection change for effects
  showInspector: boolean;
  showToolbox: boolean;
}

interface UIStateContextValue extends UIStateSnapshot {
  setSelectedNodeIds(ids: string[]): void;
  toggleInspector(force?: boolean): void;
  toggleToolbox(force?: boolean): void;
  clearSelection(): void;
}

const UIStateContext = createContext<UIStateContextValue | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectionAction, setSelectionAction] = useState<number>(0);
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [showToolbox, setShowToolbox] = useState<boolean>(true);

  const setSelected = useCallback((ids: string[]) => {
    setSelectedNodeIds(ids);
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
    selectionAction,
    showInspector,
    showToolbox,
    setSelectedNodeIds: setSelected,
    toggleInspector,
    toggleToolbox,
    clearSelection
  };

  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIState(){
  const ctx = useContext(UIStateContext);
  if(!ctx) throw new Error('useUIState must be used within UIStateProvider');
  return ctx;
}
