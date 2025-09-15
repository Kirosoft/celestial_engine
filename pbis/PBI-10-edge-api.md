---
id: PBI-10
title: Edge API Endpoints
phase: 1
status: completed
priority: high
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:32:30Z
dependsOn: [PBI-03, PBI-02]
---

## Goal
Provide REST endpoints for edge operations.

## Description
Routes: `POST /api/edges` add, `DELETE /api/edges/:sourceId/:edgeId` remove, `PUT /api/edges/:sourceId/:edgeId` update.

## Business Value
Full client-side graph editing capability.

## Acceptance Criteria
- Cycle rejected with 409 & message
- Unknown edge delete -> 404
- Missing target add -> 400

## Definition of Done
- Integration tests (add/remove/update/cycle)

## Implementation Checklist
- [x] POST /api/edges route
- [x] DELETE /api/edges/:sourceId/:edgeId
- [x] PUT /api/edges/:sourceId/:edgeId
- [x] Validation: target exists, no cycle
- [x] Error mapping (400/404/409)

## Test Cases
1. Add edge success returns 201
2. Add edge with missing target returns 400
3. Cycle returns 409
4. Delete non-existent returns 404

## Risks / Notes
Edge kind modifications minimal; extended metadata later. Covered via API & e2e edge lifecycle tests (see `TESTING.md`).

## Implementation Status
Edge add/update/delete endpoints fully functional with cycle/self-loop prevention surfaced as proper HTTP codes. Optimistic edge creation via canvas uses POST endpoint and is validated by UI drag test (with fallback) and API tests.

### Verified By
- Integration tests: edge add/remove/update & cycle rejection
- Playwright: edge creation & lifecycle specs (drag + integrity scenarios)

### Current Gaps / Tech Debt
- No bulk edge operations (batch add/remove)
- Metadata extension (weights, labels) not yet implemented
- Error payloads could include more diagnostic context (e.g., cycle path) (enhancement)

## Outstanding / Deferred
- Add richer error detail for cycle detection (list of involved node IDs)
- Consider batch mutation support once dispatcher (PBI-16) lands
