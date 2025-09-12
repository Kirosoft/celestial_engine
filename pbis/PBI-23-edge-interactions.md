## PBI-23: Edge Interaction & Creation

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
