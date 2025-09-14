## PBI-22: Toolbox & Node Creation UX

Goal
----
Allow users to browse available node types (schemas) and add nodes to the canvas via drag or click.

Description
-----------
Toolbox panel lists node types from `/api/schemas/nodes` (or existing endpoint). Each item shows title + short description (schema `description` if present). Clicking adds node at center of viewport; dragging adds at drop coordinates.

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

Tests
-----
- Playwright: click-add Plan node → appears.
- Negative: simulate backend 400 → error toast visible.

Dependencies
------------
- Node create API; schema loader.

Out of Scope
------------
- Node category grouping (future enhancement).
