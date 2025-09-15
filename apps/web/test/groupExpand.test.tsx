/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UIStateProvider } from '../state/uiState';
import { Canvas } from '../components/Canvas';

// We'll mock fetch to simulate: initial node list with a Group node, then subgraph fetch with proxies
const fetchMock = vi.fn();

// Intentionally use a different display name to ensure navigation uses id, not name
const groupNode = { id: 'Group-abc123', type: 'Group', name: 'My Fancy Group', position: { x:120, y:120 }, edges: { out: [] }, ports: { inputs:['inA'], outputs:['outB'] } };

const rootList = { nodes: [groupNode] };
const subgraph = { nodes: [ { id: '__input_inA', type: 'GroupInputProxy', name: 'inA', position:{ x:40, y:60 }, edges:{ out: [] } }, { id: '__output_outB', type: 'GroupOutputProxy', name: 'outB', position:{ x:400, y:60 }, edges:{ out: [] } } ], edges: [] };

describe('Group expand navigation', () => {
  beforeEach(()=>{
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
  });

  it('navigates into group and shows proxies', async () => {
    // Sequence: initial /api/nodes (possibly twice due to strict/double render) then /api/groups/:id/subgraph
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rootList), { status:200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(rootList), { status:200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(subgraph), { status:200 }));

    render(<UIStateProvider><Canvas /></UIStateProvider>);

    // Wait for group node label
  await screen.findByText('My Fancy Group');
    // Click Expand button (appears after initial load; BasicNode uses label for id)
    const expandBtn = await screen.findByText('Expand');
    fireEvent.click(expandBtn);

    // After expand, breadcrumb/back appears and proxies load
    await screen.findByText('Inside Group:');
    await waitFor(()=>{
      expect(screen.getByText('inA')).toBeInTheDocument();
      expect(screen.getByText('outB')).toBeInTheDocument();
    });
  });
});
