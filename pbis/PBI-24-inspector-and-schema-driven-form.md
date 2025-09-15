## PBI-24: Inspector & Schema-Driven Form (Nodes & Edges)

Goal
----
Provide a unified Inspector panel for both Nodes and Edges. For a selected Node: view/edit `name` and schema-driven `props`, view read-only position, and delete the node. For a selected Edge: view/edit edge-level properties (if any future schema-defined), display source/target (with navigation), and delete the edge. All editable fields leverage JSON Schema metadata for rendering + validation.

Description
-----------
When a selectable graph entity (node or edge) is selected:
* **Node Selection**: Fetch node JSON + its type schema; render form fields for `name` (simple text) and each `props` entry defined in the type schema. Position (x,y) displayed read-only (live-updates after drag). A Delete button allows removal (calls node delete API; on success inspector clears / selection resets). Unsaved changes tracked (dirty indicator + Save/Reset buttons).
* **Edge Selection**: Fetch edge model data from source node file (or consolidated edges API) and (future) its schema if edge kind schemas are introduced. Show source & target node names (clickable to re-focus). Show any editable properties (placeholder for now; still implement framework). Provide Delete button (DELETE edge endpoint). If edge deletion succeeds, inspector closes and canvas updates optimistically.
* Validation errors from backend map to individual fields if path info present; otherwise show a general error alert.

Schema-driven renderer supports primitive types (string/number/boolean), enums, and nested objects (one level) for node props. Edge property editing scaffold prepared (even if empty initially) to avoid rework when edge schemas land.

Acceptance Criteria
-------------------
Node Inspector:
- Selecting a node populates form with current values (name + props) within 150ms (network + render) on local dev dataset.
- Editing name or any prop sets dirty state; Save button enabled; Cancel/Reset restores original values.
- Save calls `PUT /api/nodes/:id` (single consolidated payload). On success: dirty state clears, canvas label updates without full page reload.
- Validation failure returns structured errors; each affected field shows inline message; form not cleared.
- Delete button removes node via `DELETE /api/nodes/:id` and triggers graph refresh; any edges referencing the node are removed (integrity guard ensures no dangling edges). Inspector empties.
- Read-only position updates within 300ms after a completed drag (poll or subscription approach acceptable for MVP).

Edge Inspector:
- Selecting an edge (via click) opens Edge view showing: edge id, kind, source (node name + port), target (node name + port).
- Delete button issues `DELETE /api/edges/:sourceId/:edgeId`; edge disappears from canvas without full reload.
- If edge properties schema (future) is absent, show placeholder text "No editable edge properties".
- If a backend delete/update error occurs, an inline error alert is shown.

General:
- Only one inspector panel instance reused; switching selection prompts unsaved-change confirmation if dirty.
- Keyboard: pressing Delete key while inspector focused with node/edge selected invokes deletion (with confirm prompt) matching PBI-23 synergy.
- Accessibility: All form inputs have associated labels; delete buttons have `aria-label` distinguishing Node vs Edge deletion.

Tests
-----
Playwright (add / expand specs):
- Edit node name + a prop then Save → reload page → values persisted.
- Invalid prop (e.g., wrong type) triggers inline validation message (simulate by sending number for string field).
- Delete node: node removed; related edges pruned; selection cleared.
- Select edge then delete (Delete key and button path) → edge removed.
- Dirty form: modify a field, select another node → confirmation modal appears; cancel preserves edits, confirm switches and discards.

Unit / Integration:
- Mapper translating backend validation errors array to field-level messages.
- Edge deletion action dispatch updates local state store.

Dependencies
------------
- Node update & delete APIs; Edge delete API.
- Schema loader (node types); (future: edge schema registry placeholder).
- Selection & global state store.

Out of Scope
------------
- Complex conditional/oneOf/allOf rendering.
- Live subscription for position (poll acceptable for MVP).
- Edge property editing beyond scaffolding for initial release.

## Implementation Status
Current Node-only inspector exists (name + props editing, dirty indicator, save). No edge inspector yet. Validation error mapping generic. No deletion from inspector (node deletion occurs via other UI or not implemented). Position read-only already displayed.

Planned Enhancements (this PBI revision):
- Add Delete buttons (node & edge).
- Introduce Edge inspector mode (read-only properties for now, with delete).
- Implement field-level error mapping logic.
- Add unsaved change guard and reset action.
- Add keyboard Delete integration (coordinate with PBI-23 completion).

### Verified By
Initial (pre-revision): Manual node edits.
Post-revision (target): Expanded Playwright specs listed above + updated API integration tests for delete.

### Current Gaps / Tech Debt
- Field-level validation mapping absent
- No edge inspector implementation
- Missing deletion + confirm flows
- No optimistic updates for prop edits
- No unsaved change guard

## Outstanding / Deferred
- Autosave or debounce save
- Advanced conditional rendering (oneOf/anyOf)
- Edge property schema integration once defined
- Position editing (manual numeric entry)
- Optimistic update w/ rollback on failure (currently full wait)
