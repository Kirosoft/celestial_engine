---
id: PBI-23
title: Edge Interaction & Creation
phase: 2
status: in-progress
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-10, PBI-11, PBI-21]
---

## Goal

Goal
----
Support creating, selecting, and deleting edges via canvas interactions.

Description
-----------
Enable connection handles on nodes (single default port per side initially). Dragging from source handle opens connection preview; dropping on target creates edge (POST to `/api/edges`). Update internal state and re-render. Provide delete via edge selection + Delete key.

Acceptance Criteria
-------------------
- Creating an edge adds it to source node file (`edges.out` entry) and re-renders without full reload.
- Self-loop blocked with user feedback.
- Cycle attempt blocked with error message from backend.
- Edge selection visually distinct; Delete removes it.

Tests
-----
- Playwright: create edge then delete → confirm removed.
- Cycle prevention: attempt forbidden edge → error toast.

Dependencies
------------
- Edge APIs; cycle detection already implemented.

Out of Scope
------------
- Multi-port / typed sockets.

## Implementation Checklist
- [x] Source/target handles on nodes
- [x] Drag-to-create edge interaction
- [x] POST edge creation & optimistic update
- [x] Cycle/self-loop prevention surfaced
- [ ] Delete via Delete key when edge selected
- [ ] Improved error toasts (cycle vs generic)
- [ ] Stabilize drag in Playwright (remove fallback)
- [ ] Visual selection styling refinement
- [ ] Accessibility: keyboard edge deletion

## Implementation Status
Core edge creation working; deletion & robust feedback pending.

## Outstanding / Deferred
- Delete key edge removal
- Rich error messaging
- Drag reliability improvements
