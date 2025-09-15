/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UIStateProvider } from '../state/uiState';
import { Canvas } from '../components/Canvas';

const fetchMock = vi.fn();

describe('Escape exits group view', () => {
  beforeEach(()=>{
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
  });

  it('leaves group on Escape and refreshes root', async () => {
    const groupNode = { id: 'Group-xyz789', type: 'Group', name: 'Group-xyz789', position:{ x:120,y:120 }, edges:{ out:[] }, ports:{ inputs:['in1'], outputs:['out1'] } };
    const rootList = { nodes: [groupNode] };
    const subgraph = { nodes: [ { id: '__input_in1', type:'GroupInputProxy', name:'in1', position:{ x:40,y:60 }, edges:{ out:[] } }, { id: '__output_out1', type:'GroupOutputProxy', name:'out1', position:{ x:400,y:60 }, edges:{ out:[] } } ], edges: [] };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rootList), { status:200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rootList), { status:200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(subgraph), { status:200 }));
    // Root reload after escape
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rootList), { status:200 }));

    render(<UIStateProvider><Canvas /></UIStateProvider>);
    await screen.findByText('Group-xyz789');
    fireEvent.click(await screen.findByText('Expand'));
    await screen.findByText('Inside Group:');
    // Focus an input (simulate inspector or other input) to ensure Escape still exits
    const tempInput = document.createElement('input');
    document.body.appendChild(tempInput); tempInput.focus();
    fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(()=> expect(screen.queryByText('Inside Group:')).toBeNull());
  // Root group node still visible (root graph reloaded)
  await screen.findByText('Group-xyz789');
  });
});
