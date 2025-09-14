Progress on Playwright e2e and FileRepo fixes
=============================================

Summary
-------

This document records progress made while getting the Playwright end-to-end tests running on a fresh Windows clone of the repository and ensuring the changes remain compatible with the original Linux setup.

What was done
-------------

- Reproduced the failure locally on Windows. The server failed to start due to a stack overflow caused by a recursive logging call between `repoRoot()` and `debugLog()`.
- Fixed the recursion by changing `apps/web/lib/fileRepo.ts`:
  - `debugLog` now computes the repo root directly from `process.env.REPO_ROOT` (trimmed) or `process.cwd()` and writes to `join(root, 'debug-paths.txt')` without calling `repoRoot()`.
  - `safeJoin` was updated to use `isAbsolute`, `path.resolve`, and `path.relative` to robustly detect path-escape attempts on both Windows and Linux.

Results
-------

- After the fix, all Playwright e2e tests pass on Windows:
  - `npm run test:e2e` in `apps/web` produced `4 passed`.
- The changes use Node's cross-platform `path` APIs and `trim()` on `REPO_ROOT`, so they should be compatible with Linux as well.

Files changed
-------------

- `apps/web/lib/fileRepo.ts` — Reworked `debugLog` and `safeJoin` to remove recursion and make path handling cross-platform.

Next steps / recommendations
----------------------------

- Add a CI job (GitHub Actions) that runs the Playwright e2e test matrix on `ubuntu-latest` and `windows-latest` to prevent regressions.
- Gate debug logging behind an environment variable (e.g., `E2E_DEBUG=true`) to avoid creating debug files during normal runs.
- Optionally add additional diagnostic output to the schema loader (persisting schema lists to the debug file) if schema-not-found resurfaces.

Status
------

- Playwright e2e tests on Windows: PASSED
- Cross-platform compatibility: Implemented; should work on Linux (recommend adding CI to verify)

If you want me to add a CI workflow or gate the debug logging behind `E2E_DEBUG`, tell me which you prefer and I will implement it.

Phase 2 PBIs Added (Command & Event Layer)
-----------------------------------------

| PBI | Title | Summary |
|-----|-------|---------|
| 15 | Command Schema Set | Define JSON Schemas for command envelope + actions with manifest & validation tests. |
| 16 | Command Dispatcher & Validation | Envelope/action validation, idempotency, version checks, batch atomicity. |
| 17 | Event Derivation & Append Log | Generate domain events and append to rotating `.awb/events.log`; replay tool. |
| 18 | Apply Functions & Transaction Semantics | Pure reducers produce mutation intents; atomic multi-file commit. |
| 19 | Undo / Redo Ring Buffer | In-memory inverse command generation & history endpoints. |
| 20 | Snapshot API & Storage | Snapshot endpoint copies consistent repo state for recovery/time-travel. |

See individual PBI markdown files (`pbis/PBI-15-*.md` .. `pbis/PBI-20-*.md`) for detailed acceptance criteria.

Phase 3 PBIs Added (UI Authoring Experience)
-------------------------------------------

| PBI | Title | Summary |
|-----|-------|---------|
| 21 | Canvas & Layout Infrastructure | React Flow canvas with nodes/edges rendering & selection state. |
| 22 | Toolbox & Node Creation UX | Schema-driven list enabling add/drag node creation. |
| 23 | Edge Interaction & Creation | Edge handles, create/delete, cycle/self-loop prevention UI. |
| 24 | Inspector & Schema-Driven Form | Edit node props/name via schema form with validation feedback. |
| 25 | Command Console Panel | JSON command input, validation, and response/events display. |
| 26 | Logs & Events Panel | Tail of recent events with filtering. |
| 27 | UI State Management & Theming | Global state store + light/dark theme persistence. |

See `pbis/PBI-21-*.md` through `pbis/PBI-27-*.md` for full details.

Phase 3 Implementation Plan
----------------------------

Detailed sequencing, architecture, and checklist: see `pbis/phase-3-implementation.md`.

Progress Notes (Phase 3)
------------------------
- Canvas scaffold (React Flow) added: initial nodes/edges rendering with reload button.
- Node drag + persisted position implemented (PBI-08 now exercised via UI): `onNodeDragStop` posts to position endpoint; positions survive reload.
- Toolbox (PBI-22 partial): `/api/node-types` endpoint + basic click-to-create node working; refresh auto-dispatch.
- Supporting hook: `useGraphData` for nodes/edges fetch and optimistic position updates.
- Next steps: selection state store, toolbox integration (PBI-22), inspector (PBI-24), edge interactions (PBI-23).
# Phase 1 Product Backlog Items

| ID | Title | Priority | Estimate | Depends On |
|----|-------|----------|----------|------------|
| PBI-01 | FileRepo – Safe Filesystem Layer | high | 3 | - |
| PBI-02 | NodeRepo – Core Node CRUD & Rename | high | 5 | PBI-01 |
| PBI-03 | Edge Management & Validation | high | 5 | PBI-02 |
| PBI-04 | Node Type Schema Loader | high | 3 | PBI-01 |
| PBI-05 | AJV Validation Service | high | 3 | PBI-04 |
| PBI-06 | Seed Node Type Schemas | high | 5 | PBI-05 |
| PBI-07 | Graph Index Builder | medium | 3 | PBI-02, PBI-05 |
| PBI-08 | Position Update Support | medium | 2 | PBI-02 |
| PBI-09 | Node API Endpoints | high | 5 | PBI-02, PBI-05, PBI-07 |
| PBI-10 | Edge API Endpoints | high | 3 | PBI-03, PBI-02 |
| PBI-11 | Integrity Guard – Dangling Edge Detection | medium | 2 | PBI-02, PBI-03 |
| PBI-12 | Standard Error & Result Types | medium | 3 | PBI-05, PBI-09, PBI-10 |
| PBI-13 | Developer Documentation (Phase 1) | medium | 3 | All previous |
| PBI-14 | Playwright Integration Test Suite | medium | 5 | PBI-09, PBI-10, PBI-06, PBI-11 |

## Navigation
- [PBI-01](PBI-01-file-repo.md)
- [PBI-02](PBI-02-node-repo.md)
- [PBI-03](PBI-03-edges.md)
- [PBI-04](PBI-04-schema-loader.md)
- [PBI-05](PBI-05-validation-service.md)
- [PBI-06](PBI-06-seed-schemas.md)
- [PBI-07](PBI-07-graph-index.md)
- [PBI-08](PBI-08-position-updates.md)
- [PBI-09](PBI-09-node-api.md)
- [PBI-10](PBI-10-edge-api.md)
- [PBI-11](PBI-11-integrity-guard.md)
- [PBI-12](PBI-12-error-handling.md)
- [PBI-13](PBI-13-docs.md)
- [PBI-14](PBI-14-playwright-integration-tests.md)

## Status Legend
- planned
- in-progress
- blocked
- done

## Next Steps
1. Prioritize and assign owners.
2. Create implementation branches per cluster (FileRepo+NodeRepo first).
3. Add test harness early (PBI-01 & PBI-02).

---
Generated: 2025-09-12
