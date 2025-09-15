---
id: PBI-21
title: Canvas & Layout Infrastructure
phase: 2
status: in-progress
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-09, PBI-10]
---

## Goal

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

## Implementation Checklist
- [x] React Flow integration wrapper component
- [x] Initial load nodes & edges from API
- [x] Persist & restore node positions
- [x] Basic selection state provider & highlight
- [x] Edge creation handles (partial early delivery from PBI-23)
- [ ] Distinct edge styling by kind (flow/data)
- [ ] Empty state call-to-action (create first node)
- [ ] Performance smoke (200 nodes) doc baseline
- [ ] Zoom/pan constraint tuning (min/max zoom)
- [ ] Accessibility pass (tab focus for nodes)

## Implementation Status
Core canvas operational; most baseline behaviors delivered. Remaining visual & perf polish pending.

## Outstanding / Deferred
- Edge styling variants by kind
- Empty state improvements
- Performance baseline >200 nodes
- Accessibility / keyboard navigation
