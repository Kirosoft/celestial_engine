---
id: PBI-02
title: NodeRepo – Core Node CRUD & Rename
phase: 1
status: completed
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:05:00Z
dependsOn: [PBI-01]
---

## Goal
Manage node lifecycle using FileRepo.

## Description
Implement `createNode(type,name?,props?)`, `getNode(id)`, `listNodes()`, `updateNode(id,patch)`, `renameNode(oldId,newId)`, `deleteNode(id)`.

## Business Value
Enables graph authoring at file level.

## Acceptance Criteria
- `createNode` assigns id `<type>-<nanoid>` (collision-safe)
- `renameNode` moves file and returns updated node
- `deleteNode` removes file; returns boolean
- All operations validate JSON shape (basic structure)

## Definition of Done
- CRUD tests (happy & error paths)
- Error modes covered (missing node, duplicate rename)
- Code documented

## Implementation Checklist
- [x] ID generator (type + nanoid)
- [x] Create Node writes JSON skeleton
- [x] Update merges props safely
- [x] Rename moves file & returns updated node
- [x] Delete removes file
- [x] Validation hook integrated
- [x] Error classes: NotFound, Conflict

## Test Cases
1. Create returns file contents with id
2. Rename changes filename and internal id field
3. Delete then get returns NotFound
4. Invalid update (non-object props) rejected

## Risks / Notes
Edge propagation originally deferred; now implemented via rename logic that updates inbound edges (see Playwright rename propagation test). Testing layers: unit + integration + e2e (`TESTING.md`).

## Implementation Status
NodeRepo feature set delivered: create/read/update/rename/delete all operational and validated. Rename now updates inbound edges (implemented earlier than originally scoped). Validation integrated via AJV service. All API endpoints (PBI-09) rely on NodeRepo and are passing integration & Playwright tests.

### Verified By
- Unit/integration tests for CRUD & rename
- Playwright: node CRUD flow, rename propagation, validation errors
- Edge lifecycle tests indirectly confirm rename updates inbound references

### Current Gaps / Tech Debt
- Inbound edge cleanup on node delete implemented at API layer? (Double‑check broader deletion propagation; full cascading verification test could be strengthened.)
- No bulk operations (batch create/update) yet
- Props update granularity is whole-object merge (no diff-based conflict detection)

## Outstanding / Deferred
- Add explicit test ensuring inbound edge cleanup after delete (hard assertion on all referencing nodes)
- Consider exposing batch APIs for performance when adding many nodes
- Potential optimistic concurrency control (version precondition) to prevent lost updates
