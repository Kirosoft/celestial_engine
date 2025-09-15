/** @vitest-environment jsdom */
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UIStateProvider, useUIState } from '../state/uiState';
import { Inspector } from '../components/Inspector';

// Helper component to drive selection from test
function SelectButton({ id }: { id: string }){
  const { setSelectedNodeIds } = useUIState();
  return <button data-testid={`select-${id}`} onClick={()=> setSelectedNodeIds([id])}>Select {id}</button>;
}

// Mock fetch implementation
const fetchMock = vi.fn();

// Basic sample node + schema data (schema mimics /api/schemas/Task shape with nested props)
const sampleNode = { id: 'n1', type: 'Task', name: 'My Task', props: { prompt: 'Hello' }, position: { x:10, y:20 } };
const taskSchema = { properties: { props: { properties: { prompt: { type: 'string', title: 'Prompt' } } } } };

describe('Inspector', () => {
  beforeEach(()=>{
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
  });

  function queueFetchSequence(){
    // 1: GET /api/nodes/n1
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ node: sampleNode }), { status:200 }));
    // 2: GET /api/schemas/Task
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ schema: taskSchema }), { status:200 }));
    // 3: PUT /api/nodes/n1
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ node: { ...sampleNode, name: 'Updated', props: { prompt: 'World' } } }), { status:200 }));
  }

  it('loads selected node and displays fields', async () => {
    queueFetchSequence();
    render(
      <UIStateProvider>
        <SelectButton id="n1" />
        <Inspector />
      </UIStateProvider>
    );

  // Two providers render (React strict / double render style from some wrappers or accidental double mount). Choose first.
  const selects = screen.getAllByTestId('select-n1');
  fireEvent.click(selects[0]);

    // Wait for name input
    await screen.findByDisplayValue('My Task');
    expect(screen.getByText('Prompt')).toBeInTheDocument();
  });

  it('saves changes and clears dirty state', async () => {
    queueFetchSequence();
    render(
      <UIStateProvider>
        <SelectButton id="n1" />
        <Inspector />
      </UIStateProvider>
    );
  const selects2 = screen.getAllByTestId('select-n1');
  fireEvent.click(selects2[0]);

    // Wait initial load
    const nameInput = await screen.findByDisplayValue('My Task');
    fireEvent.change(nameInput, { target: { value: 'Updated' }});
    const promptInput = screen.getByDisplayValue('Hello');
    fireEvent.change(promptInput, { target: { value: 'World' }});
    const saveBtn = screen.getByText('Save');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(()=> expect(screen.getByDisplayValue('Updated')).toBeInTheDocument());
    // After save third fetch resolves, button should be disabled (no dirty)
    await waitFor(()=> expect(screen.getByText('Save')).toBeDisabled());
  });
});
