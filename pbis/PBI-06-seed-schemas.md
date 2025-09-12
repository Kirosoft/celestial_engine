---
id: PBI-06
title: Seed Node Type Schemas
phase: 1
status: completed
priority: high
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-12T16:05:00Z
dependsOn: [PBI-05]
---

## Goal
Author baseline schemas for initial node set.

## Description
Create schemas for: LLM, Plan, Task, ToolCall, Router, Merge, Code, GitHubInput, GitHubOutput, Eval. Minimal viable props.

## Business Value
Unlocks creation of typed nodes and ensures future runtime compatibility.

## Acceptance Criteria
- Each schema has `$id`, `title`, `type:Object`, `properties.props` definition, `required` keys
- All schemas AJV-validated
- Example instance per type validates

## Definition of Done
- Schema directory populated
- Validation script passes

## Implementation Checklist
- [x] Draft schema template
- [x] Author LLM schema
- [x] Author Plan schema
- [x] Author Task schema
- [x] Author ToolCall schema (initial minimal)
- [x] Author Router schema
- [x] Author Merge schema
- [x] Author Code schema
- [x] Author GitHubInput schema
- [x] Author GitHubOutput schema
- [x] Author Eval schema
- [x] Validation script for all (via schemas.test.ts)

## Test Cases
1. Each example node validates
2. Missing required prop surfaces error
3. Additional property stripped if configured

## Risks / Notes
ToolCall schema generation may move to dynamic later; start static skeleton.
