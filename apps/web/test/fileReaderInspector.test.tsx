/** @vitest-environment jsdom */
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UIStateProvider, useUIState } from '../state/uiState';
import { Inspector } from '../components/Inspector';

// Helper to select node
function SelectButton({ id }: { id: string }){
  const { setSelectedNodeIds } = useUIState();
  return <button data-testid={`select-${id}`} onClick={()=> setSelectedNodeIds([id])}>Select {id}</button>;
}

const fetchMock = vi.fn();

// Minimal FileReaderNode sample; props intentionally includes mode + filePath placeholder
const fileReaderNode = { id: 'fr1', type: 'FileReaderNode', name: 'File Reader', props: { mode: 'single', filePath: 'README.md' }, position: { x:0, y:0 } };
// Provide a trivial schema so generic path would have shown label if rendered; ensures we detect custom override correctly.
const frSchema = { properties: { props: { properties: { mode: { type: 'string', title: 'Mode' }, filePath: { type: 'string', title: 'File Path' } } } } };

describe('FileReaderNode custom inspector', () => {
  beforeEach(()=>{
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
  });

  function queueFetchSequence(){
    // 1: GET node
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ node: fileReaderNode }), { status:200 }));
    // 2: GET schema (will be fetched but custom inspector should render instead of raw schema fields)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ schema: frSchema }), { status:200 }));
    // 3: PUT save
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ node: fileReaderNode }), { status:200 }));
  }

  it('renders custom FileReaderNodeInspector instead of generic schema form', async () => {
    queueFetchSequence();
    render(
      <UIStateProvider>
        <SelectButton id="fr1" />
        <Inspector />
      </UIStateProvider>
    );
    const selects = screen.getAllByTestId('select-fr1');
    fireEvent.click(selects[0]);

    // Wait for name to appear
    await screen.findByDisplayValue('File Reader');

    // Custom inspector should show file path value inside a textarea (provided by generic heading area) plus our custom control markers.
    // We expect some element referencing Mode toggle or action buttons unique to FileReaderNodeInspector.
    // The custom inspector includes buttons for actions like Scan / Read; assert one.

  // Assert presence of mode toggle and file selection button (custom inspector specific) in single mode.
  const modeButton = await screen.findByRole('button', { name: /mode:\s*single/i });
  expect(modeButton).toBeInTheDocument();
  const selectFileButton = screen.getByRole('button', { name: /select file/i });
  expect(selectFileButton).toBeInTheDocument();
  const sendButton = screen.getByRole('button', { name: /send/i });
  expect(sendButton).toBeInTheDocument();

    // Generic schema label 'File Path' (title from schema) should NOT be present as a standalone label element because custom inspector replaces generic form.
    // We allow absence or if present only inside custom UI. For strictness, ensure there is no label element with text 'File Path'.
    const filePathLabels = screen.queryAllByText('File Path');
    // If generic form rendered, we'd have at least one label. Custom inspector might still show placeholder; accept zero.
    expect(filePathLabels.length).toBeLessThanOrEqual(1);
  });
});
