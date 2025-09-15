---
id: PBI-09
title: Node API Endpoints
phase: 1
status: completed
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:32:00Z
dependsOn: [PBI-02, PBI-05, PBI-07]
---

## Goal
Expose REST endpoints for node CRUD & position.

## Description
Routes: `GET /api/nodes`, `GET /api/nodes/:id`, `POST /api/nodes`, `PUT /api/nodes/:id`, `POST /api/nodes/:id/rename`, `POST /api/nodes/:id/position`.

## Business Value
Enables UI integration & external automation.

## Acceptance Criteria
- All writes validate schema & 400 on failure
- Rename updates index
- 404 on unknown node id

## Definition of Done
- Integration tests (happy/error)

## Implementation Checklist
- [x] Route definitions
- [x] Input parsing & validation
- [x] Error mapping (404/400)
- [x] Rename handler integration with index
- [x] Position update route
- [ ] OpenAPI stub (optional later)

## Test Cases
1. Create node returns 201 & body
2. Invalid props returns 400
3. Unknown id returns 404
4. Rename persists file move

## Risks / Notes
Security/auth postponed until later. Behavior verified by API integration & Playwright tests (see `TESTING.md`).

## Implementation Status
All listed node endpoints implemented and validated through integration and Playwright tests (CRUD, rename, position, validation error scenarios). Error responses standardized via `apiErrors.ts`. Position endpoint integrates with canvas drag stop logic.

### Verified By
- Playwright: node CRUD lifecycle + rename propagation
- Integration tests for node API (see `api.nodes.test.ts`)
- E2E validation error test returning structured error payload

### Current Gaps / Tech Debt
- OpenAPI / schema documentation stub not authored (optional item left unchecked)
- No pagination or filtering (fine for current scale)
- Authentication/authorization entirely absent (not in scope yet)

## Outstanding / Deferred
- [Deferred] OpenAPI spec stub generation
- Add rate limiting / request body size guard (future security hardening)
- Document endpoint examples in developer docs (PBI-13)
