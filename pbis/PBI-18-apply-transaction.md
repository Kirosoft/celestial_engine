---
id: PBI-18
title: Apply Functions & Transaction Semantics
phase: 2
status: not-started
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-16]
---

## Goal

Goal
----
Transform validated actions into deterministic file mutations and apply them atomically.

Description
-----------
Reducers return high-level intents: `[{ op: 'write', path, content }, { op: 'delete', path }]`.
Transaction executor:
1. Stage writes to temp files (`.tmp-<ts>-<rand>`).
2. Verify no path escapes (reuse `FileRepo.safeJoin`).
3. Execute deletes after staging writes; then rename temps into place.
4. Update index & version file; flush to disk.
5. On any failure: rollback (remove staged temps) and leave repo unchanged.

Acceptance Criteria
-------------------
- Partial failure leaves no temp files & no mutated target files.
- Version increments exactly once per accepted command batch.
- Hash or mtime changes for only affected node files.
- Index reflects new state immediately after commit.

Tests
-----
- Simulated reducer failure (inject error) → assert no writes occurred.
- Multi-file mutation (add node + edge update) → atomic outcome.
- Concurrency: two rapid commands; second sees incremented version.

Dependencies
------------
- Dispatcher (PBI-16), Event Log (PBI-17) integration for ordering.

Out of Scope
------------
- Undo record creation (PBI-19) and snapshots (PBI-20).

Risks / Mitigations
-------------------
- Crash mid-rename: atomic rename semantics keep either old or new fully.
- Temp file leakage: cleanup pass on startup.

## Implementation Checklist
- [ ] Define plan operation type (write/delete with metadata)
- [ ] Temp staging implementation
- [ ] Path safety validation reuse
- [ ] Delete-after-stage ordering logic
- [ ] Atomic rename commit sequence
- [ ] Version increment & index update integration
- [ ] Failure injection test (rollback)
- [ ] Multi-file mutation atomicity test
- [ ] Concurrency version race test
- [ ] Startup temp cleanup sweep
- [ ] Docs update (transaction lifecycle)

## Implementation Status
Not started; current writes are per-file, lacking grouping & rollback.

## Outstanding / Deferred
- Metrics around transaction duration
- Optional fsync strategy evaluation
- Future: partial plan diff for snapshot optimization
