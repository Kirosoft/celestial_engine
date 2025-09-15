---
id: PBI-16
title: Command Dispatcher & Validation
phase: 2
status: not-started
priority: high
estimate: 8
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-07, PBI-15, PBI-12]
---

## Goal

Goal
----
Implement a dispatcher that validates command envelopes & actions, enforces idempotency, version checks, and routes actions to pure reducer functions.

Description
-----------
Create `/api/commands` endpoint accepting a single envelope or array (batch). Steps:
1. Parse & schema-validate envelope + actions (using schemas from PBI-15).
2. Check `idempotency_key` against in-memory + persisted ring (`.awb/idempotency.json`). Duplicate → fast success (no-op) if payload hash identical, else reject conflict.
3. Load current graph version; compare with `expected_version` if provided.
4. Build reducer plan (list of file mutations) via pure action handlers (no IO side effects yet).
5. Pass plan to transaction writer (PBI-18) or short-circuit on validation errors.
6. Return structured result `{ accepted: true, version: <new>, events: [...], undo_token }`.

Acceptance Criteria
-------------------
- Duplicate command with same `idempotency_key` and identical JSON returns HTTP 200 with `accepted:false` or `idempotent:true` flag and no version bump.
- Duplicate key with different payload returns HTTP 409 conflict.
- Mismatched `expected_version` returns 409 with `current_version`.
- Batch commands fail atomically: any invalid action aborts whole batch (no writes).
- Dispatcher emits metrics/logs (count, duration, failures) via structured log lines.

Tests
-----
- Unit: idempotency ring add/eject oldest after capacity N.
- Integration: send batch with one invalid action → ensure no files changed.
- Version race: simulate stale version expectation.
- Performance sanity: 50 commands processed < target (document baseline).

Dependencies
------------
- PBI-15 (schemas), existing repos.

Out of Scope
------------
- Undo storage (PBI-19) & snapshot (PBI-20) side effects.

Risks / Mitigations
-------------------
- Race conditions: Use file lock or version re-read just before commit.
- Idempotency store growth: ring buffer + periodic compaction.

## Implementation Checklist
- [ ] Define reducer action interfaces (TypeScript types)
- [ ] Implement idempotency ring (in-memory)
- [ ] Persist idempotency ring to `.awb/idempotency.json`
- [ ] Envelope + action schema validation integration
- [ ] Version precondition check logic
- [ ] Action to plan translation (no IO side-effects)
- [ ] Batch atomicity guard (rollback on any failure)
- [ ] Logging & basic metrics (counts, durations)
- [ ] `/api/commands` endpoint handler
- [ ] Integration tests: idempotency, version conflict, invalid batch abort
- [ ] Performance baseline test (e.g., 50 command batch timing)
- [ ] Docs README update referencing dispatcher

## Implementation Status
Not started. REST endpoints perform direct mutations; dispatcher abstraction absent.

## Outstanding / Deferred
- File lock / optimistic concurrency strategy refinement
- Metrics aggregation backend (future)
- Retry semantics for transient IO errors
