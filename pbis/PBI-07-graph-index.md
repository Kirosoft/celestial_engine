---
id: PBI-07
title: Graph Index Builder
phase: 1
status: in-progress
priority: medium
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:25:00Z
dependsOn: [PBI-02, PBI-05]
---

## Goal
Maintain `.awb/index.json` with summary of nodes.

## Description
Build on startup and update incrementally after node CRUD & rename. Format: `{ version, generatedAt, nodes:[{ id, type, name, mtime, propsHash }] }`.

## Business Value
Accelerates listings and forms basis for caching & invalidation.

## Acceptance Criteria
- Rebuild on missing/corrupted index
- Incremental update < 20ms for single node change
- Props hash stored (SHA-1 of props JSON)

## Definition of Done
- Tests: create nodes, rename, index reflects changes

## Implementation Checklist
- [x] Index file format definition
- [x] Build function (scan directory)
- [x] Incremental updater on CRUD
- [x] Props hash computation
- [ ] Corruption detection & rebuild path

## Test Cases
1. Initial build lists created nodes
2. Rename updates id entry
3. Corrupted index triggers rebuild
4. Props change updates hash

## Risks / Notes
Large graphs later may need lazy rebuild; MVP is synchronous. Current functionality covered by integration & e2e tests (CRUD and rename). Corruption detection test pending (see `TESTING.md` future work).

## Implementation Status
Index builds on startup (or first access) and updates incrementally on node CRUD & rename. Props hash computation present and used. Basic happy-path tests and e2e flows exercising rename & CRUD rely on index output. Corruption detection & automatic rebuild logic not yet implemented (currently assumes index is either present & trusted or rebuilt only if missing).

### Verified By
- Integration/e2e: CRUD, rename propagation relying on index lookups
- Unit/integration tests for incremental updates (where present)

### Current Gaps / Tech Debt
- Missing corruption detection (e.g., checksum mismatch / invalid JSON recovery)
- No explicit test injecting a corrupted index file
- No performance metrics for rebuild with larger node counts

## Outstanding / Deferred
- Implement corruption detection & auto rebuild (acceptance criterion gap)
- Add test: write malformed JSON to index then trigger rebuild path
- Capture rebuild timing metrics for scale planning
- Consider incremental hashing strategy to avoid full props re-hash on bulk operations
