# PBI-28: Group Nodes / Nested Subgraph Support

## Goal
Introduce a first-class "Group" (a.k.a. composite / container) node type that encapsulates a nested subgraph of standard nodes. This enables hierarchical modeling: a high‑level Plan/Workflow node can internally orchestrate a set of lower‑level Task / Tool / Eval nodes. The parent graph interacts with the group node only via its declared inputs and outputs.

## Core Concepts
| Concept | Description |
|---------|-------------|
| Group Node | A node with a `kind: group` (or `type: Group`) whose internal children form an isolated subgraph persisted separately. |
| Entrance (Input) Node | Auto-created proxy inside the group representing each exposed parent input edge. |
| Exit (Output) Node | Auto-created proxy inside the group representing each exposed parent output connection. |
| Subgraph Canvas | A scoped canvas view entered via an "Expand" affordance on the group node. |
| Boundary Contract | Set of named inputs/outputs the group exports to its parent context. |

## User Stories
1. As a user, I can create a Group node from the toolbox (or convert an existing set of selected nodes into a new Group) so that I can encapsulate complexity.
2. As a user, I can click an "Expand" button on a Group node to navigate into its nested canvas and view/edit internal nodes.
3. As a user, I see special stylized Input and Output boundary nodes inside a group that define the interface to the parent graph.
4. As a user, I can add or rename group input/output ports (which updates the boundary nodes and parent node port list).
5. As a user, I can connect external edges to the group node’s declared inputs/outputs just like any other node.
6. As a user, I can collapse (navigate back) to the parent canvas and see the Group node with an updated summary (e.g. status, counts, or last run result).
7. As a user, I cannot create edges that illegally cross the group boundary except via declared inputs/outputs.
8. As a user, deleting a Group prompts for confirmation and (optionally) cascades delete of its subgraph (or offers extraction of internal nodes to parent).

## Non-Goals (Phase 1)
- Execution/runtime orchestration semantics beyond structural modeling.
- Cross-group direct edges without boundary ports.
- Deep diff / versioning of internal subgraphs.
- Copy/paste between groups (future).

## Data & Persistence Model
### Option A (Recommended): Separate Subgraph File Directory
- Parent node file for Group retains: `{ id, type: 'Group', name, props, ports: { inputs: [...], outputs: [...] }, subgraphRef: 'groups/<groupId>/' }`.
- Internal nodes stored under `groups/<groupId>/nodes/*.json`.
- Internal index file at `groups/<groupId>/.awb/index.json` (mirrors top-level structure) for isolation & potential reuse.
- Allows loading internal graph lazily on expand.

### Option B: Embed Subgraph JSON inside Parent Node
- Simpler single-file persistence but risks large diffs & concurrent edits; harder to stream incremental changes.
- Rejected for scalability & modularity.

Chosen: **Option A** (directory-based isolation) to keep repository primitives consistent.

## API Surface Additions
| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/groups` | POST | Create new empty group (optionally from selected node IDs to move) | Returns group node + subgraphRef |
| `/api/groups/:id` | GET | Fetch group metadata (boundary ports) | Minimal data; not full subgraph |
| `/api/groups/:id/subgraph` | GET | Fetch internal nodes + edges | For expand view |
| `/api/groups/:id/ports` | PUT | Update boundary input/output definitions | Adjusts internal proxy nodes |
| `/api/groups/:id/move-in` | POST | Move existing node(s) from parent into group | Rewrites node files/edges |
| `/api/groups/:id/extract` | POST | Extract internal nodes back to parent | (Phase 2) |
| `/api/groups/:id` | DELETE | Delete group (and optionally cascade internal nodes) | Query param `mode=cascade|extract|abort` |

Internals can reuse existing node CRUD endpoints with a `subgraph` / `scope` query parameter (alternative: distinct router path prefix). Simpler initial approach: namespaced routes under `/api/groups/:id/*`.

## Schema / Node Type Changes
Add `Group.schema.json`:
```json
{
  "$id": "Group",
  "title": "Group",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "ports": {
      "type": "object",
      "properties": {
        "inputs": { "type": "array", "items": { "type": "string" } },
        "outputs": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["inputs", "outputs"],
      "additionalProperties": false
    },
    "summary": { "type": "string" }
  },
  "required": ["name", "ports"],
  "additionalProperties": true
}
```

## UI / UX Requirements
### Group Node Card (Parent Canvas)
- Distinct style (e.g. thicker border, subtle background pattern).
- Displays group name and port counts (e.g. `↦ 2 in | 1 out`).
- Buttons:
  - `Expand` (primary) – navigates into subgraph view.
  - (Future) `Run` / `Summarize`.

### Subgraph View
- Breadcrumb / Back button ("← Parent: <Name>").
- Dedicated mini-canvas replacing the main canvas area (reuse existing Canvas with a `scope=groupId`).
- Auto-present special nodes:
  - `__group_input__` (for each declared input) – outputs internal edges.
  - `__group_output__` (for each declared output) – receives internal edges.
- Adding an internal node behaves like normal but restricted to internal scope.
- Attempting to connect an edge from a non-proxy internal node to outside scope is disallowed.

### Port Editing Dialog
- Accessible from parent Group node ("Edit Ports").
- Add/remove port names (validate uniqueness + non-empty + safe chars).
- Removal warns if port currently wired.
- Save triggers PUT to `/api/groups/:id/ports` and re-renders proxies inside.

### Visual Differentiation
| Element | Style Hint |
|---------|------------|
| Group node | Rounded rectangle + accent border color + small folder / layers icon |
| Input proxy | Small pill node with arrow-in icon |
| Output proxy | Small pill node with arrow-out icon |

## Validation Rules
- Port names must be unique within inputs and within outputs. Additionally for Phase 1 we WILL enforce **disjoint sets** (an input name cannot also be an output name) to reduce cognitive load; future relaxation possible.
- Port name pattern: `^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$` (add validator helper) – keeps them filesystem and URL friendly.
- At least one array allowed to be empty (a group can have 0 inputs or 0 outputs initially).
- When deleting a group: if any external edges attached -> must select cascade or abort (extract optional in phase 2).

## Edge Semantics
- Parent graph edges connect: ExternalNode → Group (input port) OR Group (output port) → ExternalNode.
- Internal edges connect: InputProxy(portName) → InternalNode, InternalNode → OutputProxy(portName), or InternalNode ↔ InternalNode.
- No direct edge: ExternalNode ↔ InternalNode (enforced during create).

## Integrity & Index Updating
- Each group maintains its own index file; parent index stores group node only (not internal nodes).
- On internal node create/delete: update group-specific index.
- On group delete cascade: remove subgraph directory + group node file + update parent index.
- On rename of internal nodes: confined to subgraph index.

## Migration / Backwards Compatibility
- Existing nodes unaffected.
- Loader: if encountering `type: Group` but no `subgraphRef`, create an empty subgraph directory lazily.

## Events Additions
Align with existing convention `graph:*` (see `graph:refresh-request`, `graph:update-node-label`).
| Event | Detail Payload | Purpose |
|-------|----------------|---------|
| `graph:group-updated-ports` | `{ id, inputs, outputs }` | Refresh parent canvas representation |
| `graph:group-enter` | `{ id }` | Trigger view swap to subgraph |
| `graph:group-exit` | `{ id }` | Return to parent view |

## Security / Isolation Considerations
- Ensure path joins never escape `groups/<groupId>` root.
- Validate groupId pattern (e.g. slug or UUID) before file operations.

## Performance Considerations
- Lazy load subgraph only when expanded.
- Cache schema for Group like others.
- Potential future optimization: precompute summary (node count) and store in parent group node for quick display.

## Acceptance Criteria
1. Creating a Group node yields file + empty subgraph folder with index.
2. Expanding a Group shows a canvas containing only boundary proxies (matching defined ports).
3. Adding internal nodes and edges updates subgraph index only.
4. Ports edited: proxies update, parent node summary updates, edges referencing removed ports are rejected (or pruned with warning – choose behavior). Document behavior.
5. External edges can only connect to declared ports.
6. Deleting a Group in cascade mode removes all subgraph artifacts.
7. Basic tests: unit (port validation), integration (create/expand/ports update), E2E (create group, expand, add internal node, connect through boundary, collapse back).

## Test Plan (Initial)
| Level | Scenario |
|-------|----------|
| Unit | Port validation (unique, character set, add/remove) |
| API Integration | Create group → fetch subgraph (empty proxies) |
| API Integration | Update ports (add/remove) reflects in subgraph proxies |
| E2E | Create group, expand, add Task node internally, connect input proxy → Task → output proxy, collapse back |
| E2E (negative) | Attempt external edge to internal node (should fail) |
| E2E (delete) | Cascade delete removes directory |

## Open Questions
- Should ports have typed metadata (e.g. data schema) or remain untyped strings in phase 1? (Phase 1: untyped.)
- Allow reordering of ports? (Phase 2.)
- Extract internal nodes on delete instead of cascade? (Phase 2 feature flag.)
- Port summary metrics (which ones to surface first?)

Resolved (removed from list): Input/output port name sets disjoint in Phase 1.

## Future Enhancements
- Port type annotations + validation.
- Collapsed group summary metrics (counts / last run status / quick stats).
- Group template cloning.
- Nested groups (multi-level) – design supports this inherently with directory recursion.
- Cross-group copy/paste.
- Execution orchestration & scheduling semantics.

_Initial draft: 2025-09-15 – refined 2025-09-15_

## Implementation Plan (Incremental)
Deliver in thin vertical slices to keep E2E usable after each step.

### Slice 1: Schema & Node Type Registration
1. Add `schemas/nodes/Group.schema.json` (as specified) + commit.
2. Update README node types table (add Group) – optional.
3. Smoke: create Group node manually via existing POST /api/nodes (temporary) to ensure schema loads.

### Slice 2: File Structure & Repo Helpers
1. Introduce `GroupRepo` with helpers: `initGroup(id)`, `groupRoot(id)`, `listGroupNodes(id)`, `createGroupNode(id, type, ...)` (scoped variants reusing NodeRepo with base path argument or duplication kept minimal).
2. Implement safe directory creation under `groups/<groupId>/` with its own `.awb/index.json` via adapted `IndexRepo` utility (extract shared functions or provide param for base path).
3. Add boundary proxy synthesis (in-memory objects, not persisted as standalone NodeFiles yet; or persist as `__proxy_input_<port>.json` for simplicity). Decision: persist so they appear in subgraph listing deterministically.

### Slice 3: Group Creation API
1. `POST /api/groups` accepts body `{ name, inputs?: string[], outputs?: string[] }`.
2. Creates parent Group node file in top-level `nodes/` with `type: 'Group', ports, subgraphRef`.
3. Initializes subgraph directory + index + proxy node files.
4. Emits `graph:refresh-request`.

### Slice 4: Subgraph Fetch API
1. `GET /api/groups/:id/subgraph` returns `{ nodes, edges }` reading from subgraph index & node files (including proxies).
2. Add optional `scope=group:<id>` param to existing node list route (backwards compat) – for UI reuse.

### Slice 5: Ports Update API
1. `PUT /api/groups/:id/ports` with `{ inputs, outputs }`.
2. Validate patterns + disjointness; compute add/remove diff.
3. Create/delete proxy node files accordingly; reject removal if proxy currently wired to internal edges unless `?force=1`.
4. Emit `graph:group-updated-ports` + generic refresh.

### Slice 6: UI – Expand / Nested Canvas
1. Add `GroupNode` React Flow custom renderer (distinct styling, buttons: Expand, Edit Ports).
2. Maintain `uiState.currentGroupId` (undefined = root). Breadcrumb + Back button.
3. When entering group: fetch subgraph via new API, map proxy nodes to styled pills.
4. Event listeners for `graph:group-updated-ports` to refresh if inside that group.

### Slice 7: Edge Creation Constraints
1. Modify edge creation API: if either source or target is inside a group while other is outside and not a boundary proxy, reject.
2. Utilize `sourcePort`/`targetPort` fields when connecting parent external node to Group node (UI will choose port from dropdown).
3. In subgraph, connecting from InputProxy sets `sourcePort=portName` on internal edges? (Internal edges need no parent-level port assignment; only external edges carry port names.) Clarify: Only parent edges require port mapping; internal edges remain unchanged.

### Slice 8: Deletion Semantics
1. `DELETE /api/groups/:id?mode=cascade` removes subgraph folder & parent node.
2. Integrity pass: scrub external edges referencing the group.
3. Emit refresh events.

### Slice 9: Tests
1. Unit: port validation helper.
2. Integration: create group, update ports, subgraph fetch.
3. E2E: create group via toolbox (add temporary Group entry), expand, add internal node, connect through boundary, back out.
4. E2E negative: attempt illegal edge; assert rejection message.

### Slice 10: Polish & Docs
1. README updates (architecture & usage for groups).
2. PBI acceptance criteria cross-check & mark complete.
3. Open questions decisions recorded.

Deferrals:
- Extract mode on delete.
- Nested groups deeper than 1 level (though design compatible) – add test after basic stability.
- Performance optimization (lazy proxy generation) – not needed initial scale.
