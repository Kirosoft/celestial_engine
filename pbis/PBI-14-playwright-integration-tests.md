---
id: PBI-14
title: Playwright Integration Test Suite
phase: 1
status: planned
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
- CI-ready configuration (can run headless)
- Parallel-safe (unique temp repo root per test worker)
- Documentation in README test section
- Execution time for suite < 15s locally

## Implementation Checklist
- [ ] Add Playwright dev dependency & config
- [ ] Add `test:e2e` npm script
- [ ] Helper to launch Next server programmatically with dynamic REPO_ROOT
- [ ] FS isolation strategy (temp dir per worker)
- [ ] Test: node CRUD flow
- [ ] Test: edge add/update/delete + cycle rejection
- [ ] Test: rename updates index & edges
- [ ] Test: integrity guard repair (simulate deletion)
- [ ] Test: validation error (missing type)
- [ ] Artifact assertions (.awb/index.json changes, node file presence)
- [ ] README update with instructions

## Test Scenarios
1. Create node -> assert file exists and index entry present
2. Add edge -> source node file shows outbound edge
3. Delete target file manually -> list API returns repair report
4. Attempt cycle -> 409 response
5. Missing required field -> 400 with error object
6. Rename node -> old file removed, new file present, index updated
7. Delete node -> inbound edges cleaned

## Risks / Notes
- Need to ensure server reuse between specs to limit startup overhead
- Race conditions if tests run in parallel sharing same repo root; mitigate by per-worker path.

