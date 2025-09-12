## PBI-25: Command Console Panel

Goal
----
Allow power users to submit raw command envelopes (Phase 2 dispatcher) and see structured response & events.

Description
-----------
Console text editor (JSON) with validate button. On submit, POST to `/api/commands`. Display formatted response (accepted, version, events). Maintain history list (last 20 submissions). Provide pretty-print & copy.

Acceptance Criteria
-------------------
- Valid command executes; node or edge changes reflected on canvas.
- Validation error highlights JSON error region (line/col or path).
- History persists within session (in-memory) with ability to re-run.

Tests
-----
- Playwright: submit add_node command → node appears.
- Invalid envelope: missing actions triggers validation display.

Dependencies
------------
- Dispatcher API implementation.

Out of Scope
------------
- Multi-tab consoles, diff viewers.
