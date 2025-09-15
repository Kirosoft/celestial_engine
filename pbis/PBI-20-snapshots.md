---
id: PBI-20
title: Graph Snapshot API & Storage
phase: 2
status: not-started
priority: medium
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-16, PBI-17, PBI-18, PBI-19]
---

## Goal
Enable creation of point-in-time repository snapshots for recovery, diffing, and future time-travel features.

## Description
Endpoint: `POST /api/snapshots` (implicit single graph). Copies all `nodes/*.json`, edges, index, and version marker into `.awb/snapshots/<unixTs>-<label>/`.
Metadata file: `snapshot.json` with `{ id, ts, label, version, nodeCount, edgeCount }`.
List endpoint: `GET /api/snapshots` returns metadata array (sorted newest first).
Restore (Phase 2 scope: dry-run diff; full restore may stage only, optional manual tool future).

## Business Value
Provides safety net for destructive mistakes and foundation for rollback & time-travel debugging.

## Acceptance Criteria
- Snapshot directory contains complete consistent set (hash compare vs live at creation moment).
- Snapshot creation latency under 200ms for 500 small nodes (document measurement).
- Listing returns correct counts & sorted order.
- Concurrent create attempts are serialized or rejected with clear error.

## Definition of Done
- APIs implemented & tested.
- Snapshot metadata validated (schema or runtime guard).
- Performance test executed & result documented.
- Docs updated with usage & constraints.

## Implementation Checklist
- [ ] Define snapshot metadata type
- [ ] Implement create snapshot service (temp dir + atomic rename)
- [ ] Implement list snapshots service
- [ ] Hash verification routine (optional integrity check flag)
- [ ] Add POST /api/snapshots route
- [ ] Add GET /api/snapshots route
- [ ] Guard: reject if another snapshot in progress
- [ ] Performance measurement (log & doc result)
- [ ] Tests: create single snapshot
- [ ] Tests: create multiple, verify ordering & counts
- [ ] Tests: concurrent creation conflict
- [ ] Tests: hash verification correctness
- [ ] Docs: README / snapshots section

## Implementation Status
Not started.

## Outstanding / Deferred
- Diff API (snapshot vs live) beyond basic hash compare
- Incremental / delta snapshots
- Automated retention / pruning policies
- Full restore endpoint (may be CLI only later)
