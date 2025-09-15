---
id: PBI-17
title: Event Derivation & Append Log
phase: 2
status: not-started
priority: medium
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-16, PBI-18, PBI-20]
---

## Goal

Goal
----
Generate domain events from accepted commands and append them to a durable JSON lines log for replay and auditing.

Description
-----------
For each action, produce one or more events (e.g., `NodeAdded`, `NodeUpdated`, `EdgeAdded`, `EdgeRemoved`, `GraphSnapshotCreated`). Event shape: `{ id, ts, commandId, type, data, version }`.
Implement `.awb/events.log` (append-only). Rotate when >5MB to `.awb/events.<n>.log`. Provide a lightweight reader to stream tail events for future UI panel.

Acceptance Criteria
-------------------
- Each accepted command produces ≥1 event; event count matches actions except where reducers coalesce (documented).
- Event log append is atomic (no partial lines) even under concurrent commands.
- Rotation preserves chronological ordering; new file created seamlessly.
- Replay tool can reconstruct graph state up to a target version with zero diff vs live.

Tests
-----
- Append 100 commands → count events = expected.
- Force rotation threshold with small max size config in test; ensure rollover works.
- Replay: run commands, rebuild from events only, compare node JSON hashes.

Dependencies
------------
- Dispatcher (PBI-16) for accepted command stream.

Out of Scope
------------
- Streaming SSE API (future phase).

Risks / Mitigations
-------------------
- File corruption: use atomic append (fs.open + appendFile) and optional checksum field per line.
- Large log size: rotation + future compaction (snapshot). 

## Implementation Checklist
- [ ] Define event types (TS enums / string unions)
- [ ] Action→event mapping table
- [ ] Append writer with rotation threshold
- [ ] Atomic append implementation (no partial lines)
- [ ] Event serialization (JSON lines) with optional checksum field
- [ ] Replay utility (rebuild graph from events)
- [ ] Replay verification test (hash compare vs live)
- [ ] Rotation test (forced small threshold)
- [ ] Documentation: event types & rotation strategy

## Implementation Status
Not started. No `.awb/events.log` or derivation logic.

## Outstanding / Deferred
- Checksums / integrity markers
- SSE / streaming API
- Compaction via periodic snapshot (ties into PBI-20)
