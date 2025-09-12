---
id: PBI-08
title: Position Update Support
phase: 1
status: in-progress
priority: medium
estimate: 2
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:30:00Z
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
- [ ] Input validation (numbers)
- [ ] API route handler
- [ ] Optional debounce placeholder

## Test Cases
1. Position persists after update
2. Invalid coordinates rejected
3. Rapid sequence ends with final value

## Risks / Notes
Future debounce at API layer; MVP can be direct.
