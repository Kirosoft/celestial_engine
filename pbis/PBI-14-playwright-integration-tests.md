---
id: PBI-14
title: Playwright Integration Test Suite
phase: 1
status: completed
priority: medium
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-12
dependsOn: [PBI-09, PBI-10, PBI-06, PBI-11]
---

## Goal
Provide end-to-end confidence by exercising API + filesystem side-effects through a browser-driven flow (or direct HTTP where UI not yet present) using Playwright.

## Description
Introduce Playwright to run integration tests that spin up the Next.js dev server and execute flows covering core PBIs:
- Node CRUD lifecycle (PBI-02)
- Edge management (PBI-03)
- Index updates (PBI-07)
- Integrity guard behavior (PBI-11)
- Schema validation failures (PBI-05/06)

Where UI pages are not yet implemented, tests will use direct HTTP requests via Playwright's APIRequestContext while still validating server start, and verifying filesystem artifacts (`nodes/*.json`, `.awb/index.json`).

## Business Value
Reduces regression risk by validating real startup path, HTTP stack, and disk persistence end-to-end beyond unit tests.

## Acceptance Criteria
- Playwright configured with separate test command (`npm run test:e2e`)
- Server launched automatically (dev or custom script) for test run
- Tests create nodes, add edges, rename, delete, and confirm filesystem reflects operations
- Dangling edge scenario repaired and reported via `/api/nodes` integrity payload
- Validation error scenario returns structured error (400 with errors array)
- All artifacts cleaned between spec runs (isolated state)

## Definition of Done
- Headless-capable configuration (runs locally via `npm run test:e2e`)
- Serialization chosen (workers:1) to avoid global Ajv / env root race (parallelization deferred)
- Core graph operations, integrity repair, validation error, and rename edge propagation covered
- Suite runtime ~3–4s locally (< 15s target)
- Rename propagation test ensures inbound edges update after target rename

Deferred (Not in this increment):
- Parallel-safe multi-worker isolation
- README section addition (tracked separately)
- CI pipeline wiring

## Implementation Checklist
- [x] Add Playwright dev dependency & config
- [x] Add `test:e2e` npm script
- [x] Helper/reset to manage REPO_ROOT between tests
- [x] FS isolation strategy (pragmatic single shared root with cleanup; per-worker deferred)
- [x] Test: node CRUD flow
- [x] Test: edge add/update/delete + cycle rejection
- [x] Test: rename updates index & edges (added dedicated rename propagation spec)
- [x] Test: integrity guard repair (simulate deletion)
- [x] Test: validation error (missing type)
- [x] Artifact assertions (.awb/index.json and node file presence/absence)
- [ ] README update with instructions (deferred)

## Test Scenarios
1. Create node -> assert file exists and index entry present
2. Add edge -> source node file shows outbound edge
3. Delete target file manually -> list API returns repair report
4. Attempt cycle -> 409 response
5. Missing required field -> 400 with error object
6. Rename node -> old file removed, new file present, index updated
7. Delete node -> inbound edges cleaned

## Risks / Notes
- Parallelization deferred; global Ajv + env root makes multi-worker brittle (tracked for enhancement)
- README & CI integration still pending
- Future fix: inject repo root context rather than process.env to allow workers>1

