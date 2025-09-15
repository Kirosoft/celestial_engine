## PBI-19: Undo / Redo Ring Buffer

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

## Implementation Status
Not started. No undo/redo endpoints or ring buffer structures implemented.

## Outstanding / Deferred
- Define inverse action generation rules
- Implement history ring + capacity eviction tests
- Add endpoints /api/undo, /api/redo, /api/history
