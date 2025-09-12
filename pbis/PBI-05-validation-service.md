---
id: PBI-05
title: AJV Validation Service
phase: 1
status: completed
priority: high
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:15:00Z
dependsOn: [PBI-04]
---

## Goal
Central validator for node props and full node objects.

## Description
Initialize AJV with options; compile each node schema; provide `validateNode(node)` returning `{ valid, errors? }`.

## Business Value
Guarantees structural integrity and consistent failure messaging.

## Acceptance Criteria
- Invalid props blocked at create/update (400)
- Errors formatted (path, message)
- Validate 100 nodes < 50ms warm

## Definition of Done
- Unit tests covering valid & invalid samples

## Implementation Checklist
- [x] AJV instance initialization
- [x] Compile all node schemas on load
- [x] validateNode function + error normalization
- [ ] Performance benchmark script (deferred)
- [x] Integration with NodeRepo create/update

## Test Cases
1. Valid node passes (returns valid=true)
2. Missing required prop fails with path
3. Additional property removal (if configured) enforced
4. Performance test under threshold

## Risks / Notes
Command validation added in later phase. Validator exercised in unit, integration, and e2e tests (see `TESTING.md`).
