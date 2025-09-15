---
id: PBI-22
title: Toolbox & Node Creation UX
phase: 2
status: in-progress
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-15, PBI-21]
---

## Goal

Goal
----
Allow users to browse available node types (schemas) and add nodes to the canvas via drag or click. Toolbox must be movable (drag reposition), collapsible, and remember its last position + collapsed state between sessions (local persistence acceptable).

Description
-----------
Toolbox panel lists node types from `/api/schemas/nodes` (or existing endpoint). Each item shows title + short description (schema `description` if present). Clicking adds node at center of viewport; dragging adds at drop coordinates (future). The toolbox itself:
* Draggable: user can grab header and move anywhere within viewport bounds.
* Collapsible: clicking a chevron/minimize control collapses content to a compact header bar (width ~ header intrinsic size).
* Persistence: position (x,y) and collapsed state stored (in-memory + localStorage) and restored on reload.
* Z-index above canvas but below modal dialogs; does not capture Delete key when an input inside it is focused (keyboard guard synergy).

Status (2025-09-14)
-------------------
- Implemented `GET /api/node-types` enumerating schema files.
- Added `Toolbox` component listing node types (click-to-create).
- Node creation triggers graph refresh; newly created node persists.
- Drag-to-add not yet implemented (click only for now).
- Error surfacing (toast/UI) not yet implemented.

Next Steps
----------
- Add drag-and-drop placeholder for future spatial add.
- Display schema descriptions underneath titles.
- Provide inline error feedback on failure.

Acceptance Criteria
-------------------
- Toolbox lists all seed schemas (LLM, Plan, Task, ToolCall, Router, Merge, Code, GitHubInput, GitHubOutput, Eval).
- Adding node persists (subsequent reload shows node via API).
- Duplicate adds allowed; each gets unique id.
- Errors surfaced if backend validation fails (toast or inline error list).
- Toolbox can be dragged to at least four distinct quadrants; position persists after page reload.
- Collapsing toolbox hides list items, leaving header bar with title + (expand) icon; expanding restores list.
- Toolbox drag constrained so it cannot be moved fully off-screen (at least 24px of header remains visible on each axis).
- Toolbox collapsed state persists across reload.
- Dragging toolbox does not cause unintentional text selection (use `user-select: none` while dragging).

Tests
-----
- Playwright: click-add Plan node → appears.
- Negative: simulate backend 400 → error toast visible.
- Playwright: drag toolbox to bottom-right, reload → remains bottom-right (within ~10px tolerance).
- Playwright: collapse toolbox, reload → remains collapsed.
- Playwright: ensure at least part of header visible after multiple drags near edges.

Dependencies
------------
- Node create API; schema loader.

Out of Scope
------------
- Node category grouping (future enhancement).

## Implementation Checklist
- [x] Endpoint exposing node schemas list
- [x] Toolbox component renders schema list
- [x] Click-to-create node at viewport center
- [x] Persistence: position + collapsed state (localStorage)
- [ ] Drag-to-add coordinate placement
- [ ] Display schema descriptions
- [ ] Error feedback (toast) on creation failure
- [ ] Prevent off-screen drag (24px visible constraint)
- [ ] Accessibility: focus & keyboard activation
- [ ] Playwright tests for position persistence & collapse

## Implementation Status
Core toolbox operational with click create & persistence; drag-to-add & UX polish pending.

## Outstanding / Deferred
- Drag-to-add coordinate placement
- Schema descriptions rendering
- Error toast / user-visible feedback
