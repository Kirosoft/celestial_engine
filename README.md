<div align="center">

# Celestial Engine

Graph + schema‑driven execution workspace with a file-backed repository, validation, and evolving UI for node & edge introspection.

</div>

## 1. Overview
Celestial Engine manages a graph of typed nodes and edges stored as JSON on disk. Each node type is defined by a JSON Schema, enabling:
* Schema‑driven property forms (Inspector)
* Validation + structured error responses
* Deterministic defaults when creating nodes (required prop inference)

The UI (Next.js + React Flow) provides a canvas to position nodes, inspect/edit properties, and manage edges. A file index and integrity guard maintain consistency after mutations or external file edits.

## 2. Key Features
| Area | Capability | Notes |
|------|------------|-------|
| Node Schemas | JSON Schema per node type | Loaded from configurable paths; cached & compiled lazily |
| Validation | AJV-based field errors | Surfaces exact field paths (e.g. `props.maxTasks`) |
| Node CRUD | Create / update / rename / position / delete | File-backed, index updated incrementally |
| Edges | Add / delete with integrity checks | Guard prunes dangling edges |
| Index | Central `.awb/index.json` | Tracks nodes + prop hash + positions |
| Integrity Guard | Repairs/prunes after external deletions | Executes during list / certain operations |
| Inspector | Node & edge detail panel | Resizable, schema‑driven form, delete actions |
| Toolbox | Draggable & collapsible node type palette | Persists position & collapsed state |
| Persistence | LocalStorage for UI layout | Keys documented below |
| Events | Lightweight DOM CustomEvents | e.g. `graph:update-node-label`, `graph:refresh-request` |
| Testing | Vitest + Playwright | Unit, API integration, E2E layers |

## 3. Architecture
### 3.1 Layers
* API Routes (`/apps/web/pages/api/*`): Thin adapters performing validation and persistence via repositories.
* Repositories (`lib/*Repo.ts`): File system operations (nodes, versions, index).
* Validator & Schema Loader (`lib/validator.ts`, `lib/schemaLoader.ts`): Load and compile JSON Schemas, produce per-field errors.
* Integrity Guard (`lib/integrityGuard.ts`): Scans edges/nodes for inconsistencies.
* Frontend State (`state/uiState.tsx`): Selection, panel visibility, layout persistence, width/position.
* Components (`components/*.tsx`): Canvas (React Flow driven), Toolbox, Inspector.

### 3.2 Data Files
| Path | Purpose |
|------|---------|
| `nodes/<id>.json` | Individual node documents |
| `.awb/index.json` | Index of nodes (positions, hashes) |
| `schemas/nodes/*.schema.json` | Node type schemas |
| (Consolidated) | All node type schemas now live ONLY at repo root `schemas/nodes/` (removed duplicate app copy) |

### 3.3 Events
| Event | Producer | Consumer | Effect |
|-------|----------|----------|--------|
| `graph:refresh-request` | Toolbox / Deletions | Graph data hook | Reload node/edge data |
| `graph:update-node-label` | Inspector rename/save | Canvas | Update node label without full reload |

## 4. UI Behavior
### 4.1 Toolbox
* Draggable: Grab header to reposition. Position persists.
* Collapse/Expand: Toggle button (− / +) persists state.
* Close: Hides toolbox; an "Open Toolbox" button appears (same area that previously contained it).

### 4.2 Inspector
* Shows node or edge details; schema drives property editors (enum, number, boolean, string inputs).
* Left-edge resize handle: Drag horizontally (min 260px, max 600px). Double-click resets width (320px).
* Close button (×) hides the panel; floating "Open Inspector" button appears top-right.
* Unsaved changes badge appears until saved / reset.

### 4.3 Keyboard & Safety
* Delete key guarded inside input fields to avoid accidental node/edge deletion while editing props.

## 5. Persistence (LocalStorage Keys)
| Key | Description |
|-----|-------------|
| `ui.inspector.visible` | `1` or `0` for panel visibility |
| `ui.inspector.width` | Last width (px) between 260–600 |
| `ui.toolbox.x` / `ui.toolbox.y` | Last position (absolute coordinates) |
| `ui.toolbox.collapsed` | Toolbox collapsed state |

All layout defaults use deterministic SSR-safe starting values and hydrate after mount (prevents hydration warnings).

## 6. Development Setup
```bash
git clone <repo>
cd celestial_engine/apps/web
npm install
npm run dev
```
Open http://localhost:3000.

IMPORTANT: The `dev` script sets `REPO_ROOT=../..` so the file repository and schema loader can discover node schemas at the monorepo root (`schemas/nodes/*.schema.json`). If you manually run `next dev` without this variable, certain node types (e.g. `Group`) will fail to validate or return `404 not_found schema` errors when creating. Always use `npm run dev` or export `REPO_ROOT` yourself:

```bash
REPO_ROOT=../.. next dev
```

### 6.1 Creating a Node Type Schema
1. Add `YourType.schema.json` to `schemas/nodes/` (or path via `SCHEMA_PATHS`).
2. Include at least: `$id`, `title`, and a `properties` block. If using nested props, put form fields inside `properties.props.properties`.
3. Restart dev server or trigger a schema reload (currently on-demand; restart ensures freshness).

### 6.2 Useful Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm test` | Run unit + integration tests (Vitest) |
| `npm run test:e2e` | Run Playwright E2E suite |

## 7. Testing Overview
High-level summary (see [TESTING.md](./TESTING.md) for deep detail):
* Unit & integration focus on repositories, validators, and API contracts.
* Playwright covers CRUD flows, integrity repair, edge operations, and UI interactions (toolbox drag, etc.).
* One inspector resize test is temporarily skipped pending investigation into a dynamic canvas rendering race.

### 7.1 Skipped Test Note
`inspector-resize.spec.ts` currently `test.skip()`; remove skip after diagnosing missing React Flow node rendering in headless E2E start.

## 8. Group Nodes (Composite Subgraphs)
Group nodes encapsulate a nested subgraph referenced by `subgraphRef` (`groups/<groupId>`). When created, input/output port declarations materialize as proxy nodes (`GroupInputProxy` / `GroupOutputProxy`) inside the subgraph.

Navigation rule: Always use the immutable `id` (e.g. `Group-abc123`) for API endpoints: `/api/groups/<id>/subgraph`. The human-friendly `name` can change and MUST NOT be used in URLs. The UI now passes `nodeId` explicitly to avoid 404 errors when `name` differs from `id`.

Planned next slices (not yet implemented):
* Internal node CRUD inside a group's subgraph.
* Edge constraints preventing illegal cross-boundary links.
* Port editing UI (diff + proxy sync already supported server-side).
* Group deletion semantics.

Implemented so far:
* Proxy generation (inputs/outputs) at creation.
* Subgraph listing with proxies + real nodes (created via `POST /api/groups/:id/nodes`).
* In-group node creation from Toolbox when viewing a group.
* Escape key exits current group; Back button always visible while inside.
* Nested groups: You can create a Group while inside another Group; a nested `subgraphRef` directory is created and seeded with its own proxies.

### 8.1 Proxy Schemas
Minimal JSON Schemas for `GroupInputProxy` and `GroupOutputProxy` live under `schemas/nodes/`. These remove 404 schema load errors during validation and allow proxies to be treated like normal nodes in the graph list / inspector (with limited editable props). If you customize proxy props, extend these schemas (keeping `$id` stable) and restart the dev server.

### 8.2 Nested Groups
When viewing a group subgraph, the Toolbox "Group" button issues `POST /api/groups/:groupId/nodes` with `type: "Group"`. The server:
1. Persists the nested group node JSON inside the parent subgraph directory.
2. Generates a `subgraphRef` (e.g. `groups/Group-parent123/groups/Group-child456`).
3. Seeds the child subgraph with input/output proxies based on its declared `ports`.

Navigation Rules:
* Click the Expand control on any Group node to enter its subgraph (loads via `/api/groups/:id/subgraph`).
* Press `Esc` or use the Back button to return to the parent (root if at top level).
* Selection clears on enter/exit to prevent stale node references.

Limitations / Current Behavior:
* Edges cannot yet span across group boundaries (enforced implicitly by UI fetch scoping). Cross-boundary edge policies are future work.
* Deleting a group does not recursively delete nested subgraphs yet—avoid manual nested deletion until lifecycle rules are finalized.
* No UI yet for editing an existing group's port lists (would require proxy reconciliation).

### 8.3 Subgraph Edges
Each group owns an `edges.json` file under its subgraph directory. The API provides CRUD for edges local to that group:

| Operation | Route | Notes |
|-----------|-------|-------|
| Create | `POST /api/groups/:id/edges` | Body: `{ sourceId, targetId, kind? }` (kind defaults to `flow`) |
| Update | `PUT /api/groups/:id/edges/:edgeId` | Body subset (currently supports `{ kind }`) |
| Delete | `DELETE /api/groups/:id/edges/:edgeId` | Removes edge from `edges.json` |
| List (implicit) | `GET /api/groups/:id/subgraph` | Returns `{ nodes, edges }` |

Validation & Constraints:
* Self-loops rejected with `409 { error.code: "cycle" }`.
* Cycles within the subgraph (A→B, B→C, C→A) are rejected (DFS check before write).
* Edges are confined to nodes inside the same group; proxies may participate (policy TBD if future restrictions desired).

Inspector Integration:
* Selecting a subgraph edge shows Kind (editable between `flow` / `data`) and delete controls.
* Saving Kind triggers a refresh event; changes persist to `edges.json`.
* Edge selection clears node selection and vice versa (consistent with root graph behavior).

Known / Future Work:
* Cross-boundary edge semantics (proxy connection mapping) not yet defined.
* Batch operations, edge labels, or data mapping not implemented.
* Potential future validation to disallow proxy→proxy edges if deemed semantically meaningless.

Testing:
* A unit/integration style test (`nestedGroupCreateExpand.test.tsx`) verifies nested creation + proxy seeding without relying on filesystem persistence.
* E2E coverage for nested groups can be added once more interaction patterns (edges, deletion) are implemented.

## 9. Error Handling & Validation
* API returns JSON `{ error: { message, fields? } }`. `fields` is an array of `{ path, message }` enabling precise form error mapping.
* Inspector maps `props.*` paths to individual inputs; `name` errors surface under Name field.

## 10. Roadmap (Excerpt from PBIs)
| PBI | Focus | Status |
|-----|-------|--------|
| PBI-22 | Movable toolbox & add node UX | Implemented |
| PBI-24 | Inspector schema-driven form & resize | Implemented (resize test skip) |
| Future | Undo/Redo, Snapshots, Command Console, Logs Panel | Planned |
| Future | Parallel E2E + CI integration | Planned |

## 11. Troubleshooting Quick Table
| Symptom | Possible Cause | Mitigation |
|---------|----------------|-----------|
| Hydration style mismatch (Toolbox) | Pre-hydration localStorage access | Already fixed (delayed hydration) |
| Inspector resize test times out | Canvas dynamic mount race | Skip test; add canvas readiness instrumentation |
| Node create 400 | Missing required schema props | Add required `props` fields per schema |
| Duplicate schema compile warnings | AJV recompile | Should be idempotent; restart if persistent |

## 12. Environment Variables
| Variable | Purpose | Example |
|----------|---------|---------|
| `SCHEMA_PATHS` | Additional schema glob sources (root already included) | `schemas/nodes/*.schema.json,plugins/*/nodes/*.schema.json` |
| `DEBUG_SCHEMAS` | Verbose loader logging | `DEBUG_SCHEMAS=1` |
| `REPO_ROOT` | Repository base for file + schema ops | Set by `npm run dev` (../..) & in E2E (.e2e-root) |

Examples:
```bash
SCHEMA_PATHS='schemas/nodes/*.schema.json,plugins/*/nodes/*.schema.json' DEBUG_SCHEMAS=1 npm test
```

## 13. Contributing Guidelines (Lightweight)
1. Add/adjust schema → add/adjust tests.
2. For public API changes, update PBIs / spec docs.
3. Keep new UI components minimal and testable (prefer pure functions for data transforms).
4. Run full test suite before PR.

## 14. Known Gaps / Future Enhancements
* Canvas snapshot + multi-select operations.
* Undo/redo transaction stack.
* Node/edge command console (PBI-25).
* Persistent dark/light theming toggle (PBI-27 scope).
* Performance benchmarking script for large graphs.
* Re-enable inspector resize spec with deterministic canvas readiness signal.

## 15. Licensing
TBD (add LICENSE file before external distribution).

---
_Last updated: 2025-09-15 (subgraph edges & inspector editing)_
