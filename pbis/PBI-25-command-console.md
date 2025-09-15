---
id: PBI-25
title: Command Console Panel
phase: 2
status: not-started
priority: medium
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-16]
---

## Goal

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

## Implementation Checklist
- [ ] Console panel shell (toggleable)
- [ ] JSON editor (textarea MVP)
- [ ] Client-side JSON validation & error highlight
- [ ] Submit to /api/commands
- [ ] Render response (status, version, events)
- [ ] History (20 entries) with re-run
- [ ] Copy & pretty-print actions
- [ ] Error path highlight (schema validation)
- [ ] Playwright: successful command add_node
- [ ] Playwright: invalid envelope shows error

## Implementation Status
Not started (dispatcher pending).

## Outstanding / Deferred
- Advanced editor (monaco)
- Multi-tab / saved scripts
