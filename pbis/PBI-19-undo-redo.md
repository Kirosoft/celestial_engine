---
id: PBI-19
title: Undo / Redo Ring Buffer
phase: 2
status: not-started
priority: medium
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-18]
---

## Goal

Goal
----
Provide reversible command history (last N) enabling client to undo & redo recent mutations reliably.

Description
-----------
Maintain in-memory ring buffer (config N=50). For each committed command store `{ command, inverseCommands[], versionBefore, versionAfter }`.
Inverse generation rules per action (e.g., `add_node` → `delete_node`; `rename_node` → `rename_node` oldName; `update_node` → previous property diff; `move_node` → previous position). Redo simply replays original command if still valid.
Expose endpoints: `POST /api/undo`, `POST /api/redo`, `GET /api/history` (recent summary).

Acceptance Criteria
-------------------
- Undo immediately after a command reverts all its effects (node files & index identical to pre-state).
- Redo after undo reapplies identical state (hash equality).
- Buffer drops oldest entries after capacity with no impact on new commands.
- Undo blocked if graph changed externally (version mismatch) with clear error.

Tests
-----
- Sequence: create → rename → move → undo x3 returns clean empty repo.
- Overflow: execute N+5 commands → history length == N.
- External edit (simulate manual file write) invalidates undo chain.

Dependencies
------------
- Reducers (PBI-18) & dispatcher.

Out of Scope
------------
- Persistent history across restarts (future enhancement).

Risks / Mitigations
-------------------
- Drift if reducers become side-effectful → enforce purity & state snapshotting for inverse computation.

## Implementation Checklist
- [ ] Define inverse mapping per action
- [ ] Ring buffer data structure (configurable capacity)
- [ ] Store pre/post version metadata
- [ ] Undo endpoint (/api/undo)
- [ ] Redo endpoint (/api/redo)
- [ ] History endpoint (/api/history)
- [ ] External change detection (version mismatch handling)
- [ ] Tests: linear undo/redo chain
- [ ] Tests: capacity eviction
- [ ] Tests: invalid undo after external mutation
- [ ] Docs update (usage & limits)

## Implementation Status
Not started; no history structures or endpoints.

## Outstanding / Deferred
- Persistence across restarts
- Grouped multi-command undo (future)
