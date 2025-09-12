## PBI-18: Apply Functions & Transaction Semantics

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
