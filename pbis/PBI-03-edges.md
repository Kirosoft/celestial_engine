---
id: PBI-03
title: Edge Management & Validation
phase: 1
status: completed
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:10:00Z
dependsOn: [PBI-02]
---

## Goal
Support adding/removing/updating edges while preserving DAG constraint.

## Description
Store outbound edges on source node under `edges.out[]`. Provide functions: `addEdge(sourceId,targetId,kind,ports?)`, `removeEdge(sourceId,edgeId)`, `updateEdge(sourceId,edgeId,patch)`. Perform cycle detection via DFS.

## Business Value
Enables meaningful graph structure for execution/design.

## Acceptance Criteria
- Self-loop rejected with explicit error
- Cycle attempt rejected (A→B, B→C, then C→A fails)
- Edge IDs stable (nanoid)
- Removing node later cleans inbound references (future scope)

## Definition of Done
- Unit tests for cycle detection (positive & negative)

## Implementation Checklist
- [x] Edge structure defined in node JSON
- [x] addEdge performs validations
- [x] removeEdge by id
- [x] updateEdge supports kind / ports
- [x] Cycle detection DFS
- [x] Self-loop rejection
- [x] Nanoid edge id generator

## Test Cases
1. Add valid edge stored on source
2. Self-loop rejected
3. Cycle A->B, B->C, C->A rejected
4. Remove edge actually deletes entry

## Risks / Notes
Cycle detection naive is fine at MVP scale (<1k edges). Covered by unit tests and e2e cycle rejection scenario (see `TESTING.md`).

## Implementation Status
Edge add/update/remove fully operational with cycle & self-loop prevention. Edge IDs stable. Integrated into API (PBI-10) and exercised via Playwright tests including cycle rejection. Rename propagation of target node IDs handled via NodeRepo rename logic.

### Verified By
- Unit tests: cycle detection, self-loop, CRUD
- Playwright: edge add/update/delete, cycle 409 scenario
- Integrity guard test (dangling edge repair) indirectly validates edge storage layout

### Current Gaps / Tech Debt
- Performance of cycle detection is O(N+E) DFS per add; acceptable now, may need incremental cycle check optimization later
- No direct test of large chain cycle performance threshold
- Inbound edge cleanup on node delete relies on higher-level logic; dedicated validation test could be added

## Outstanding / Deferred
- Optimize cycle detection (cache ancestors or maintain topological order) for larger graphs
- Add load/performance test for 1k edges operations
- Extend edge model to support multi-port / typed sockets (future PBI scope)
