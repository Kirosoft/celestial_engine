---
id: PBI-27
title: UI State Management & Theming
phase: 2
status: in-progress
priority: medium
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-21, PBI-22, PBI-24, PBI-25]
---

## Goal

Goal
----
Provide lightweight global state (selection, panels open, history) and theming (light/dark) with persistence.

Description
-----------
Implement a React context or small state library (Zustand) to hold selection, toolbox visibility, active panels, console history. Add theme toggle persisted to `localStorage`.

Acceptance Criteria
-------------------
- Selection state shared across canvas and inspector.
- Theme toggle updates UI instantly and persists across reload.
- Console history retained after panel close within same session.
- No memory leak from listeners (cleanup verified).

Tests
-----
- Unit: state store selectors return expected slices.
- Playwright: toggle theme → body has theme class after reload.

Dependencies
------------
- Prior UI PBIs (canvas, console) for integration points.

Out of Scope
------------
- Internationalization; advanced accessibility theming.

## Implementation Checklist
- [x] Selection state shared (nodes/edges)
- [x] Panel visibility state (toolbox, inspector)
- [ ] Theme toggle (light/dark) + persistence
- [ ] Console history slice
- [ ] Migrate / refactor to Zustand (optional sizing spike)
- [ ] Tests: selection propagation unit
- [ ] Playwright: theme persists after reload

## Implementation Status
Selection + panel visibility implemented in `uiState.tsx`; theming & console history pending.

## Outstanding / Deferred
- Theming system
- Zustand migration (if complexity increases)
- Console history persistence
