/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UIStateProvider } from '../state/uiState';
import { Canvas } from '../components/Canvas';
import { Toolbox } from '../components/Toolbox';

// This test ensures a newly created group seeds default ports and proxies appear on expand.

describe('Group creation seeds default proxies', () => {
  const fetchMock = vi.fn();
  beforeEach(()=>{
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
  });

  it('creates group with default in/out proxies visible after expand', async () => {
    const groupId = 'Group-test01';
    // Dynamic dispatcher: decide response based on URL + method
    let firstRootLoad = true;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as any).url;
      const method = (init?.method || 'GET').toUpperCase();
      // Initial root load
      if(url === '/api/nodes' && method === 'GET'){
        if(firstRootLoad){
          firstRootLoad = false;
          return Promise.resolve(new Response(JSON.stringify({ nodes: [] }), { status:200 }));
        } else {
          return Promise.resolve(new Response(JSON.stringify({ nodes: [ { id: groupId, type:'Group', name:'Group', position:{ x:120,y:120 }, edges:{ out:[] }, ports:{ inputs:['in'], outputs:['out'] } } ] }), { status:200 }));
        }
      }
      if(url === '/api/node-types' && method === 'GET'){
        return Promise.resolve(new Response(JSON.stringify({ nodeTypes: [ { id:'Group', title:'Group', description:'', schemaId:'Group', requiredPropKeys: [] } ] }), { status:200 }));
      }
      if(url === '/api/groups' && method === 'POST'){
        return Promise.resolve(new Response(JSON.stringify({ group: { id: groupId, type:'Group', name:'Group', position:{ x:120,y:120 }, edges:{ out:[] }, ports:{ inputs:['in'], outputs:['out'] }, subgraphRef:`groups/${groupId}` } }), { status:201 }));
      }
      if(url === `/api/groups/${groupId}/subgraph` && method === 'GET'){
        return Promise.resolve(new Response(JSON.stringify({ nodes: [ { id:'__input_in', type:'GroupInputProxy', name:'in', position:{ x:40,y:60 }, edges:{ out:[] } }, { id:'__output_out', type:'GroupOutputProxy', name:'out', position:{ x:400,y:60 }, edges:{ out:[] } } ], edges: [] }), { status:200 }));
      }
      return Promise.resolve(new Response('Not Found', { status:404 }));
    });

    render(<UIStateProvider><Canvas /><Toolbox /></UIStateProvider>);

    // Wait for toolbox to load
    await screen.findByText('Group');
    fireEvent.click(screen.getByText('Group'));

    // Wait for group node to appear with Expand button
    await waitFor(async ()=>{
      const expand = await screen.findByText('Expand');
      expect(expand).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Expand'));

    await screen.findByText('in');
    await screen.findByText('out');
  });
});
