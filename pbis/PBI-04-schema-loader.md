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
Generated tool schemas may grow; indexing added later. Loader behavior validated by schema unit tests (see `TESTING.md`).

## Implementation Status
Schema loader loads all node schemas at startup and exposes retrieval + reload. AJV compilation occurs in validation service; loader correctness proven by successful validation of seed schemas and API request schema checks.

### Verified By
- Unit tests: valid/invalid schema load, reload scenario
- Indirect: Node create/update API validations succeed/fail appropriately

### Current Gaps / Tech Debt
- No watch mode for live schema editing in dev
- No caching metrics or load timing instrumentation
- Error messages could include file path context for faster debugging

## Outstanding / Deferred
- Implement optional filesystem watch to trigger automatic reload
- Add logging/telemetry around schema load durations & failures
- Provide CLI command to list schemas & validation status
