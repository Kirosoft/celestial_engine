/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UIStateProvider } from '../state/uiState';
import { Canvas } from '../components/Canvas';
import { Toolbox } from '../components/Toolbox';

const fetchMock = vi.fn();

describe('Toolbox creates node inside current group', () => {
  beforeEach(()=>{
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
  });

  it('posts to group nodes endpoint when inside group', async () => {
    const groupId = 'Group-abcd12';
    const groupNode = { id: groupId, type: 'Group', name: groupId, position:{ x:120,y:120 }, edges:{ out:[] }, ports:{ inputs:[], outputs:[] } };
    const rootList = { nodes: [groupNode] };
    const emptySubgraph = { nodes: [], edges: [] };
    const createdNode = { id:'Task-xyz999', type:'Task', name:'Task', props:{}, position:{ x:180,y:140 }, edges:{ out:[] } };

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if(url.endsWith('/api/nodes')) return new Response(JSON.stringify(rootList), { status:200 });
      if(url.includes('/api/groups/') && url.endsWith('/subgraph')) return new Response(JSON.stringify(emptySubgraph), { status:200 });
      if(url.endsWith('/api/node-types')) return new Response(JSON.stringify({ nodeTypes: [ { id:'Task', title:'Task', schemaId:'Task', requiredPropKeys:[] } ] }), { status:200 });
      if(url.includes(`/api/groups/${groupId}/nodes`) && init?.method === 'POST') return new Response(JSON.stringify({ node: createdNode }), { status:201 });
      // After creation refresh subgraph call
      if(url.includes('/api/groups/') && url.endsWith('/subgraph') && fetchMock.mock.calls.filter(c=> (c[0] as string).includes('/subgraph')).length > 1){
        return new Response(JSON.stringify({ nodes: [createdNode], edges: [] }), { status:200 });
      }
      return new Response('not found', { status:404 });
    });

    render(<UIStateProvider><Canvas /><Toolbox /></UIStateProvider>);
    await screen.findByText(groupId);
    fireEvent.click(screen.getByText('Expand'));
    await screen.findByText('Inside Group:');
    const taskBtn = await screen.findByText('Task');
    fireEvent.click(taskBtn);
    await waitFor(()=>{
      const ok = fetchMock.mock.calls.some(c=> typeof c[0] === 'string' && (c[0] as string).includes(`/api/groups/${groupId}/nodes`));
      if(!ok) throw new Error('waiting');
    });
    const calledGroupCreate = fetchMock.mock.calls.some(c=> typeof c[0] === 'string' && (c[0] as string).includes(`/api/groups/${groupId}/nodes`));
    expect(calledGroupCreate).toBe(true);
  });
});
