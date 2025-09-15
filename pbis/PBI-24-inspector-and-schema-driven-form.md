## PBI-24: Inspector & Schema-Driven Form

Goal
----
Editable form for selected node's `props`, `name`, and position using JSON Schema → UI form generation (e.g., RJSF or custom minimal renderer).

Description
-----------
When a node is selected, fetch its node type schema; render a form to edit `props`. Submitting triggers update API. Name editable in header. Position not directly edited in form (handled by drag) but displayed.

Acceptance Criteria
-------------------
- Selecting node populates form with current values.
- Changing props and saving persists; canvas updates (e.g., name label).
- Validation failures show field-level messages from backend errors.
- Unsaved changes indicator appears if dirty.

Tests
-----
- Playwright: edit node name + prop → verify persisted.
- Negative: invalid prop type triggers validation message.

Dependencies
------------
- Node update API; schema loader.

Out of Scope
------------
- Advanced conditional UI widgets.

## Implementation Status
Inspector component implemented: loads selected node + schema list, renders editable name & props form with basic field types (string/number/boolean/enum). Dirty state indicator and save button included. Validation error mapping to specific fields not yet implemented (generic error message only). Position displayed read-only.

### Verified By
- Manual: select node, edit name/props, save, observe canvas refresh (label update)
- Underlying API tests ensure update persistence

### Current Gaps / Tech Debt
- Field-level validation error mapping (backend errors[]) not parsed to per-field messages
- No optimistic UI update while saving (waits for response)
- No unsaved change navigation guard

## Outstanding / Deferred
- Parse structured validation errors and surface per-field
- Add loading / disabled states to individual fields during save
- Implement simple form autosave or reminder
