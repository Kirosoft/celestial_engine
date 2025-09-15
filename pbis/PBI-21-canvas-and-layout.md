## PBI-21: Canvas & Layout Infrastructure

Goal
----
Provide a React Flow based canvas rendering nodes (position, type, name) and edges (flow/data) with pan/zoom and basic selection behaviors.

Description
-----------
Introduce a `Canvas` component wrapping React Flow. Nodes are loaded from `/api/nodes` response; edges reconstructed from node `edges.out`. Each node rendered with minimal header (name, type badge). Edge styling differs by `kind`.

Acceptance Criteria
-------------------
- Nodes appear at stored positions after reload.
- Edges display with distinct styles for `flow` vs `data`.
- Panning and zooming function smoothly; positions preserved (no unintended jitter).
- Selecting a node highlights it and triggers selection state (context provider).
- Empty state message when no nodes exist.

Tests (Manual/Automated)
------------------------
- Playwright: load canvas with 3 nodes & 2 edges → verify node labels present.
- Snapshot test for edge class names given `kind`.

Dependencies
------------
- Existing node API (Phase 1) and edge data in node files.

Out of Scope
------------
- Drag-to-create edges (handled in toolbox/interaction PBI-23).
- Custom node resize/ports.

Risks / Mitigations
-------------------
- Performance with large graphs: lazy mount & simple memoization.

## Implementation Status
Canvas implemented using React Flow. Nodes/edges load from API, positions persist on drag stop. Selection highlights and selection badge implemented. Basic error/loading overlays present. Edge handles & creation integrated (part of PBI-23 scope delivered early).

### Verified By
- Playwright: canvas interaction tests (edge creation, node drag with fallback)
- Manual inspection: nodes render with labels & positions

### Current Gaps / Tech Debt
- No distinct edge styling differences by kind yet (single style)
- Pan/zoom supported by React Flow defaults (no custom constraints)
- No empty-state call-to-action (just static message)

## Outstanding / Deferred
- Add edge styling variants by `kind`
- Improve empty state with create node quick action
- Performance test with >200 nodes (baseline FPS / interaction latency)
