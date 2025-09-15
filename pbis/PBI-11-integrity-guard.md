---
id: PBI-11
title: Integrity Guard – Dangling Edge Detection
phase: 1
status: completed
priority: medium
estimate: 2
owner: TBA
created: 2025-09-12
updated: 2025-09-12T16:05:30Z
dependsOn: [PBI-02, PBI-03]
---

## Goal
Validate graph integrity when listing nodes.

## Description
Scan all nodes; ensure each outbound edge target exists; strip or flag orphan edges and report telemetry.

## Business Value
Prevents UI crashes and builds trust in file state.

## Acceptance Criteria
- Corrupt edge removed or flagged; response returns repairs list
- Log count of repairs

## Definition of Done
- Test: inject invalid targetId; load list repairs it

## Implementation Checklist
- [x] Integrity scan function
- [x] Repair strategy (remove orphan edges)
- [x] Logging of repairs count (report object; console optional)
- [x] Hook into listNodes API path

## Test Cases
1. Orphan edge removed
2. Log contains repair count
3. No-op when graph clean

## Risks / Notes
Later improvement: separate repair report file. Integrity behavior validated by e2e dangling edge repair test (see `TESTING.md`).

## Implementation Status
Integrity scan executes on node list retrieval, removing orphan edges and reporting repairs count. E2E test injects dangling edge and confirms auto-repair. Logging currently minimal (console + response object).

### Verified By
- Playwright: dangling edge repair scenario
- Integration tests (if present) indirectly through node listing expectations

### Current Gaps / Tech Debt
- No persistence of repair audit (only transient response)
- No configurable repair policy (always removes; alternative could flag only)
- No metric aggregation (repairs per interval)

## Outstanding / Deferred
- Persist repair report (e.g., `.awb/integrity.log` or JSON lines)
- Expose integrity health endpoint for monitoring
- Add option to run in "detect-only" mode (no modifications) for dry runs
