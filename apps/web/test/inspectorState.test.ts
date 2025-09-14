import { describe, it, expect } from 'vitest';
import React from 'react';
import { UIStateProvider, useUIState } from '../state/uiState';
import { createRoot } from 'react-dom/client';

function mountHook<T>(hook: ()=>T){
  const host = document.createElement('div');
  document.body.appendChild(host);
  let current: T;
  const Test = () => { current = hook(); return null; };
  const root = createRoot(host);
  root.render((<UIStateProvider><Test /></UIStateProvider>));
  return { get current(){ return current!; }, unmount(){ root.unmount(); host.remove(); } };
}

describe('UIState selection convenience', () => {
  it('exposes selectedNodeId as first element', () => {
    const h = mountHook(()=> useUIState());
    h.current.setSelectedNodeIds(['A','B']);
    expect(h.current.selectedNodeId).toBe('A');
    expect(h.current.selectedNodeIds).toEqual(['A','B']);
    h.unmount();
  });
});