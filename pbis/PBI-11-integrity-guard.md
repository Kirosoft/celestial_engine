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
Later improvement: separate repair report file.
