import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface UIStateSnapshot {
  selectedNodeIds: string[];
  selectedNodeId?: string; // convenience: first selected or undefined
  selectedEdgeId?: string;
  selectionAction?: number; // increments on any selection change for effects
  showInspector: boolean;
  showToolbox: boolean;
  toolboxX: number;
  toolboxY: number;
  toolboxCollapsed: boolean;
  inspectorWidth: number; // px
  currentGroupId?: string; // when set, viewing subgraph for this group
  hydrated: boolean; // client layout values loaded from localStorage
  showSettings?: boolean;
}

interface UIStateContextValue extends UIStateSnapshot {
  setSelectedNodeIds(ids: string[]): void;
  setSelectedEdge(id: string | undefined): void;
  toggleInspector(force?: boolean): void;
  toggleToolbox(force?: boolean): void;
  setToolboxPosition(x: number, y: number): void;
  setToolboxCollapsed(force?: boolean): void;
  setInspectorWidth(w: number): void;
  clearSelection(): void;
  enterGroup(id: string): void;
  exitGroup(): void;
  toggleSettings(force?: boolean): void;
}

const UIStateContext = createContext<UIStateContextValue | undefined>(undefined);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>(undefined);
  const [selectionAction, setSelectionAction] = useState<number>(0);
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [showToolbox, setShowToolbox] = useState<boolean>(true);
  // Provide deterministic SSR defaults; hydrate from localStorage after mount to avoid hydration mismatches
  const [toolboxX, setToolboxX] = useState<number>(16);
  const [toolboxY, setToolboxY] = useState<number>(60);
  const [toolboxCollapsed, _setToolboxCollapsedState] = useState<boolean>(false);
  const [inspectorWidth, setInspectorWidthState] = useState<number>(320);
  const [currentGroupId, setCurrentGroupId] = useState<string|undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

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
    setShowInspector(v => {
      const next = (typeof force === 'boolean' ? force : !v);
      if(typeof window !== 'undefined') localStorage.setItem('ui.inspector.visible', next ? '1':'0');
      return next;
    });
  }, []);

  const toggleToolbox = useCallback((force?: boolean) => {
    setShowToolbox(v => (typeof force === 'boolean' ? force : !v));
  }, []);

  const toggleSettings = useCallback((force?: boolean) => {
    setShowSettings(v => (typeof force === 'boolean' ? force : !v));
  }, []);

  const setToolboxPosition = useCallback((x: number, y: number) => {
    setToolboxX(x); setToolboxY(y);
    if(typeof window !== 'undefined'){
      localStorage.setItem('ui.toolbox.x', String(Math.round(x)));
      localStorage.setItem('ui.toolbox.y', String(Math.round(y)));
    }
  }, []);

  const setToolboxCollapsed = useCallback((force?: boolean) => {
    _setToolboxCollapsedState(prev => {
      const next = typeof force === 'boolean' ? force : !prev;
      if(typeof window !== 'undefined') localStorage.setItem('ui.toolbox.collapsed', next ? '1':'0');
      return next;
    });
  }, []);

  const setInspectorWidth = useCallback((w: number)=>{
    const clamped = Math.min(600, Math.max(260, Math.round(w)));
    setInspectorWidthState(clamped);
    if(typeof window !== 'undefined') localStorage.setItem('ui.inspector.width', String(clamped));
  }, []);

  // Hydrate persisted layout values client-side after mount
  React.useEffect(()=>{
    if(typeof window === 'undefined') return;
    try {
      const vis = localStorage.getItem('ui.inspector.visible');
      if(vis === '0') setShowInspector(false);
      const x = Number(localStorage.getItem('ui.toolbox.x')); if(!Number.isNaN(x)) setToolboxX(x);
      const y = Number(localStorage.getItem('ui.toolbox.y')); if(!Number.isNaN(y)) setToolboxY(y);
      const coll = localStorage.getItem('ui.toolbox.collapsed'); if(coll) _setToolboxCollapsedState(coll === '1');
      const iw = Number(localStorage.getItem('ui.inspector.width')); if(!Number.isNaN(iw) && iw >= 260 && iw <= 600) setInspectorWidthState(iw);
    } catch {/* ignore */}
    setHydrated(true);
  }, []);

  const clearSelection = useCallback(() => setSelected([]), [setSelected]);

  const enterGroup = useCallback((id: string) => {
    // Clear prior selection to avoid stale inspector fetches inside new context
    setSelectedNodeIds([]);
    setSelectedEdgeId(undefined);
    setCurrentGroupId(id);
    if(typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('graph:group-enter', { detail: { id } }));
      // Some race conditions observed where subgraph proxies not yet visible immediately after switching context.
      // Queue a delayed refresh to ensure repositories finish writing proxy nodes before the hook loads.
      setTimeout(()=> {
        window.dispatchEvent(new Event('graph:refresh-request'));
      }, 40); // 40ms chosen as minimal delay beyond typical event loop + file write
    }
  }, []);
  const exitGroup = useCallback(() => {
    const prev = currentGroupId;
    if(prev){
      // Clear any selection to avoid inspector fetching stale (now invalid) proxy ids at root level
      setSelectedNodeIds([]);
      setSelectedEdgeId(undefined);
    }
    setCurrentGroupId(undefined);
    if(prev && typeof window !== 'undefined'){
      window.dispatchEvent(new CustomEvent('graph:group-exit', { detail: { id: prev } }));
      // Schedule a refresh after state updates so hook reloads root graph
      setTimeout(()=> {
        window.dispatchEvent(new Event('graph:refresh-request'));
      }, 0);
    }
  }, [currentGroupId]);

  const value: UIStateContextValue = {
    selectedNodeIds,
    selectedNodeId: selectedNodeIds[0],
    selectedEdgeId,
    selectionAction,
    showInspector,
    showToolbox,
    toolboxX,
    toolboxY,
    toolboxCollapsed,
    inspectorWidth,
    currentGroupId,
  hydrated,
    showSettings,
    setSelectedNodeIds: setSelected,
    setSelectedEdge,
    toggleInspector,
    toggleToolbox,
    setToolboxPosition,
    setToolboxCollapsed,
    setInspectorWidth,
    clearSelection,
    enterGroup,
    exitGroup
    ,toggleSettings
  };
  if(typeof window !== 'undefined'){
    (window as any).__selectNode = (id: string) => setSelected([id]);
    (window as any).__enterGroup = (id: string) => enterGroup(id);
    (window as any).__selectEdge = (sourceId: string, edgeId: string) => {
      // Clear node selection then set edge selection using existing setter
      setSelectedNodeIds([]);
      setSelectedEdgeId(`${sourceId}:${edgeId}`);
      setSelectionAction(a=>a+1);
    };
  }
  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIState(){
  const ctx = useContext(UIStateContext);
  if(!ctx) throw new Error('useUIState must be used within UIStateProvider');
  return ctx;
}
