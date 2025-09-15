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

## Implementation Status
Partial. A lightweight UI state hook (`useUIState`) manages selection, panel visibility (toolbox, inspector). Theming (light/dark) toggle & persistence not implemented. Console history state pending (console feature not started).

### Verified By
- Code review: `uiState.tsx` provides selection & panel toggles used by Canvas, Toolbox, Inspector

### Current Gaps / Tech Debt
- No theming system or persisted theme preference
- No global store for command console history yet
- Potential future migration to Zustand for scalability

## Outstanding / Deferred
- Implement theme toggle + persisted preference
- Introduce unified store (Zustand) if complexity increases
- Add ephemeral history storage for future console & logs panel integration
