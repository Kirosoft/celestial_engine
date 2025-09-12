## PBI-27: UI State Management & Theming

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
