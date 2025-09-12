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
