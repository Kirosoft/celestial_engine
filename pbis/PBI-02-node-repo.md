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
Edge propagation handled in later PBIs; keep rename minimal here.
