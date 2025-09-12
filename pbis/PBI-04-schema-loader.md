---
id: PBI-04
title: Node Type Schema Loader
phase: 1
status: completed
priority: high
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:12:00Z
dependsOn: [PBI-01]
---

## Goal
Load and cache JSON Schemas for node types from `schemas/nodes/*.schema.json`.

## Description
Scan on startup; optional dev watch later; expose resolver `getNodeTypeSchema(type)` with cache invalidation via `reloadSchemas()`.

## Business Value
Enables schema-driven props validation in API/UI.

## Acceptance Criteria
- Missing schema returns typed error
- Malformed schema fails fast with clear message
- Cache invalidation available

## Definition of Done
- Tests: load valid, reject invalid
- Performance: load 10 schemas under 100ms initial

## Implementation Checklist
- [x] Directory scan (`schemas/nodes/*.schema.json`)
- [x] JSON parse with error wrapping
- [x] In-memory cache map
- [x] reloadSchemas function
- [x] getNodeTypeSchema API integration

## Test Cases
1. Missing schema returns typed error
2. Invalid JSON file surfaces parse error code
3. Reload after adding file finds new schema

## Risks / Notes
Generated tool schemas may grow; indexing added later.
