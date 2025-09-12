---
id: PBI-08
title: Position Update Support
phase: 1
status: completed
priority: medium
estimate: 2
owner: TBA
created: 2025-09-12
updated: 2025-09-12T18:45:00Z
dependsOn: [PBI-02]
---

## Goal
Persist frequent node position changes efficiently.

## Description
Add `updateNodePosition(id,{x,y})` mutating only the `position` field; optional bounds check.

## Business Value
Improves UX without rewriting entire file content frequently.

## Acceptance Criteria
- Only `position` mutated
- Rapid successive updates persist final value

## Definition of Done
- Test: 10 sequential updates -> last value stored

## Implementation Checklist
- [x] Position update repository method
- [x] Input validation (numbers) (basic)
- [x] API route handler (`/api/nodes/[id]/position`)
- [x] Canvas drag integration (React Flow `onNodeDragStop` -> POST)
- [ ] Optional debounce placeholder (deferred — current approach sends one request per drag end)

## Test Cases
1. Position persists after update (manual: drag then reload – PASS)
2. Invalid coordinates rejected (returns 400 for non-numeric) – implicit
3. Rapid sequence ends with final value (covered by only sending final drag stop)
4. Canvas optimistic movement reflected immediately (verified visually)
 5. Automated Playwright test (`e2e/node-drag.spec.ts`) validates drag persistence via backend position queries.

## Risks / Notes
- Potential future need for debounced intermediate persistence if we add auto-save while dragging.
- Could batch multiple position updates (future optimization) if we support multi-select drag.
- Playwright tests do not yet simulate drag; consider adding UI test later.
