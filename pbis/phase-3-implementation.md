# Phase 3 Implementation Plan – UI Authoring Experience

Covers PBIs 21–27: Canvas & Layout, Toolbox & Node Add, Edge Interactions, Inspector & Schema Form, Command Console, Logs Panel, UI State & Theming.

## 1. Objectives
Deliver an interactive authoring interface enabling users to:
- Visualize graph (nodes + edges) with persistence.
- Add nodes from schema-driven toolbox.
- Create/delete edges interactively with cycle/self-loop prevention.
- Edit node properties via schema-driven inspector.
- Execute raw commands and observe events.
- Monitor recent domain events.
- Manage global UI state and theme.

## 2. Architectural Overview
Component Layers:
1. Data Access Hooks: `useNodes()`, `useEvents()`, `useSchemas()`, `useDispatchCommand()`.
2. State Store (Zustand or React Context): selection, panels open, console history, theme.
3. Canvas (React Flow) with mapping: NodeFile -> ReactFlow node; edges built from `edges.out`.
4. Inspector: JSON Schema to form (RJSF or lightweight generator) based on node `type`.
5. Console: JSON editor (monaco-lite or textarea) + validation + response/event linking.
6. Logs: Event tail with simple polling (later SSE upgrade).

Data Flow:
- Mutations use dispatcher (future integration) or existing REST endpoints initially; unify under commands for consistency.
- After mutation success → optimistic local update + background re-fetch/invalidate.

## 3. Sequencing & Milestones
| Order | Milestone | PBIs | Rationale |
|-------|-----------|------|-----------|
| 1 | State Store & Theme Scaffold | 27 | Foundation for cross-component communication |
| 2 | Canvas Basic Rendering | 21 | Visual baseline & integration target for later features |
| 3 | Toolbox Node Add | 22 | Node creation, drives inspector usage |
| 4 | Inspector Form | 24 | Enables editing existing nodes before edge interactions complexity |
| 5 | Edge Interactions | 23 | Requires stable node rendering & selection |
| 6 | Command Console | 25 | Power UX + validates backend dispatcher end-to-end |
| 7 | Logs & Events Panel | 26 | Observability once commands and interactions produce events |
| 8 | Hardening & Performance | 21/23/26 | Optimize rerenders, memory usage |

## 4. Detailed Tasks per PBI
### 4.1 PBI-27 State & Theming
- Choose state solution (Zustand preferred: minimal boilerplate).
- Slices: selection, toolboxOpen, panels (console, logs, inspector), theme, consoleHistory.
- Persistence: theme + recent consoleHistory (localStorage key `awb.ui.state.v1`).
- Hook: `useUIStore(selector)` convenience exports.
- Theme classes: `theme-light` / `theme-dark` on `<body>`.

Acceptance Key Implementation Notes:
- Provide migration guard: wrap JSON.parse in try/catch.

### 4.2 PBI-21 Canvas
- Install `reactflow` dependency.
- Adapter: transform NodeFile -> RF node { id, position, data: { name, type, propsHash? } }.
- Edges: flatten all `sourceNode.edges.out` entries to RF edges with compound id: `${sourceId}:${edge.id}`.
- Selection: on RF select → update store.selection; deselect on background click.
- Performance: memoize node/edge arrays via shallow equality diff to avoid full rerender.

### 4.3 PBI-22 Toolbox
- Endpoint (reuse existing schema loader or add `/api/schemas/nodes`).
- Component lists schemas sorted alphabetically; includes search filter.
- Add Node Flow:
  1. Click schema → POST create → append to store (optimistic) → scroll into view.
  2. Drag: track pointer; on drop compute canvas coords (use RF `project` func) → include position in create command.

### 4.4 PBI-24 Inspector
- Fetch selected node detail (or derive from cached list).
- Fetch schema only when type changes & cache compiled form schema.
- Form Generation: prefer `@rjsf/core` minimal theme (if bundle size acceptable) else custom mapping for basic types (string, number, boolean, enum, object, array simplified).
- Dirty tracking: deep compare initial vs current form state; show Save/Reset buttons.
- On save: call update command; optimistic merge.

### 4.5 PBI-23 Edge Interactions
- Enable connection handles on each node (one source + target area). For now treat all nodes equally.
- Validate on creation: if backend rejects (cycle/self-loop), remove optimistic edge and show toast.
- Delete edge: RF onEdgeClick + Delete key when selected.

### 4.6 PBI-25 Command Console
- JSON editor: simple `<textarea>` first; optional upgrade to Monaco later.
- Validate button: client-side `JSON.parse` try/catch; display syntax error.
- Submit: POST to `/api/commands`; display structured response (status, events count, version).
- History: push envelope string; allow reselect to load into editor.

### 4.7 PBI-26 Logs Panel
- API: implement `/api/events?limit=50` reading last N lines of events.log (reverse scan naive acceptable for MVP).
- Poll interval: 3s (configurable); only refetch if panel open.
- Filter UI: multi-select event types derived from currently loaded events.

### 4.8 Hardening
- Error Boundary wrapping canvas & inspector.
- Suspense fallback spinners where data deferred.
- Performance profiling: measure render commit durations with React Profiler sample.

## 5. API Additions (Phase 3 Scope)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/schemas/nodes` | GET | List available node type schemas metadata (title, description, type) |
| `/api/events` | GET | Tail recent events (limit param) |

(Commands endpoint expected from Phase 2 integration.)

## 6. Data Contract Notes
- Node minimal fields for UI: `{ id, type, name, position, propsHash? }` (props omitted from bulk list to reduce payload; fetch detailed on selection if large).
- Event tail record subset: `{ ts, type, data }` (Omit large payload fields; optionally include `nodeId` keys extracted via pattern.)

## 7. Testing Strategy
| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | store selectors, helper transforms (node->RF) |
| Component | React Testing Library | Inspector form change/save flow |
| E2E | Playwright | Node add, edge create/delete, prop edit, command console add_node, event appears |

Trace Artifacts: enable Playwright trace on failure for UI PBIs.

## 8. Performance & Scaling Considerations
- Virtualization not required < 500 nodes; monitor frame time.
- Debounce resize / viewport change side-effects.
- Minimize expensive JSON diffs: track hashes in index for change detection.

## 9. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| RJSF bundle size | Slower initial load | Lazy import form component |
| Event log polling overhead | Unnecessary IO | Skip polling when panel closed |
| React Flow re-render thrash | Jank | Shallow compare arrays + stable object identities |
| Undo/redo integration later | Refactor | Abstract mutation calls behind `executeCommand()` now |

## 10. Success Metrics
- Add node round-trip (click to visible) < 400ms on dev machine.
- Edge creation interaction latency < 100ms perceived.
- Form save to visual update < 500ms.

## 11. Implementation Checklist (High-Level)
- [ ] UI state store & theme
- [ ] Canvas base + data hooks
- [ ] Toolbox fetch & add node
- [ ] Inspector form integration
- [ ] Edge interactions
- [ ] Command console
- [ ] Events panel polling
- [ ] Endpoint additions (/api/schemas/nodes, /api/events)
- [ ] Basic unit tests
- [ ] Playwright UI scenarios
- [ ] Docs update (README UI section)

## 12. Post-Phase Opportunities
- SSE streaming for events panel
- Node group/cluster visualization
- Mini-map navigation
- Multi-select operations & batch commands

---
Generated: 2025-09-12
