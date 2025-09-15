---
id: PBI-24
title: Inspector & Schema-Driven Form (Nodes & Edges)
phase: 2
status: in-progress
priority: high
estimate: 8
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-15, PBI-21, PBI-22, PBI-23]
---

## Goal

Goal
----
Provide a unified Inspector panel for both Nodes and Edges. For a selected Node: view/edit `name` and schema-driven `props`, view read-only position, and delete the node. For a selected Edge: view/edit edge-level properties (if any future schema-defined), display source/target (with navigation), and delete the edge. All editable fields leverage JSON Schema metadata for rendering + validation. Inspector must be show/hide toggleable and horizontally resizable with persisted width.

Description
-----------
When a selectable graph entity (node or edge) is selected:
* **Node Selection**: Fetch node JSON + its type schema; render form fields for `name` (simple text) and each `props` entry defined in the type schema. Position (x,y) displayed read-only (live-updates after drag). A Delete button allows removal (calls node delete API; on success inspector clears / selection resets). Unsaved changes tracked (dirty indicator + Save/Reset buttons).
* **Edge Selection**: Fetch edge model data from source node file (or consolidated edges API) and (future) its schema if edge kind schemas are introduced. Show source & target node names (clickable to re-focus). Show any editable properties (placeholder for now; still implement framework). Provide Delete button (DELETE edge endpoint). If edge deletion succeeds, inspector closes and canvas updates optimistically.
* Validation errors from backend map to individual fields if path info present; otherwise show a general error alert.
* Resizable width: drag a left-edge handle (min 260px, max 600px). Double-click handle resets to default (320px). Width persists (localStorage).
* Show/Hide state persists across reload; hiding removes panel from tab order / accessibility tree.

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
- Inspector width can be resized (min 260 / max 600) and persists across reload (±2px tolerance allowed due to rounding).
- Double-click on resize handle resets width to default (320px).
- Hiding inspector (toggle) persists, and restoring inspector reapplies last width.

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
- Resize inspector: increase width by ≥120px, reload → width persists.
- Hide inspector: toggle off, reload → remains hidden; toggle on restores previous width.

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

## Implementation Checklist
- [x] Node inspector basic form (name + props)
- [x] Dirty tracking & save/reset
- [x] Read-only position display
- [ ] Edge inspector mode scaffold
- [ ] Delete (node) via inspector
- [ ] Delete (edge) via inspector
- [ ] Field-level validation error mapping
- [ ] Unsaved changes guard on selection switch
- [ ] Keyboard Delete integration (node/edge)
- [ ] Resizable width persistence (min/max constraints)
- [ ] Hide/show toggle persistence
- [ ] Playwright tests (node edit, delete, dirty guard)
- [ ] Playwright tests (edge delete)

## Implementation Status
Node-only inspector operational; edge support, deletion workflow, validation mapping pending.

## Outstanding / Deferred
- Autosave / debounce
- Advanced conditional schema (oneOf/anyOf)
- Edge property schema integration (future)
- Position manual editing
- Optimistic update with rollback
- Keyboard-accessible resize controls
