## PBI-20: Snapshot API & Storage

Goal
----
Enable creation of point-in-time repo snapshots for recovery, diffing, and future time-travel features.

Description
-----------
Endpoint: `POST /api/graphs/:id/snapshots` (graph id implicit if single graph). Copies all `nodes/*.json`, index, and event version marker into `.awb/snapshots/<unixTs>-<label>/`.
Store metadata file: `snapshot.json` with `{ id, ts, label, version, nodeCount, edgeCount }`.
List endpoint: `GET /api/snapshots` returns metadata array.
Optional restore tool (CLI-only) to copy snapshot back (manual confirmation).

Acceptance Criteria
-------------------
- Snapshot directory contains complete consistent set (hash-compare vs live at creation moment).
- Creating snapshot does not block regular command processing longer than acceptable threshold (<200ms for 500 small nodes).
- Listing snapshots returns sorted (newest first) with correct counts.
- Attempting snapshot while another is in progress is serialized or safely rejected.

Tests
-----
- Create graph (N nodes/edges) → snapshot → modify graph → snapshot → list shows 2 with correct metadata.
- Hash compare: restore (dry-run diff) matches earlier state.
- Performance: measure snapshot time for sample size (document result).

Dependencies
------------
- Command/event infrastructure (PBIs 16–18) for version & counts.

Out of Scope
------------
- Automated pruning/retention policies.
- Incremental (delta) snapshots.

Risks / Mitigations
-------------------
- Large copy cost: consider streaming + concurrency; future dedupe.
- Corruption mid-copy: use temp dir then atomic rename to final name.

## Implementation Status
Not started. No snapshot directories or endpoints implemented.

## Outstanding / Deferred
- Implement snapshot create/list endpoints & directory layout
- Add performance measurement test harness
- Provide dry-run restore verification tool
