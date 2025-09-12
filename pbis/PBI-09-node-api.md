---
id: PBI-09
title: Node API Endpoints
phase: 1
status: planned
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
- [ ] Route definitions
- [ ] Input parsing & validation
- [ ] Error mapping (404/400)
- [ ] Rename handler integration with index
- [ ] Position update route
- [ ] OpenAPI stub (optional later)

## Test Cases
1. Create node returns 201 & body
2. Invalid props returns 400
3. Unknown id returns 404
4. Rename persists file move

## Risks / Notes
Security/auth postponed until later.
