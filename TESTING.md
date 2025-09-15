# Testing Guide

This repository uses a layered testing strategy to ensure correctness, integrity, and regression safety across the file-backed graph system.

## Test Layers

| Layer | Tooling | Focus | Location |
|-------|---------|-------|----------|
| Unit / Module | Vitest | Pure functions, repositories, validators | `apps/web/*.(test).ts` under relevant dirs |
| API Integration | Vitest (supertest-style fetch) | Next.js API route behavior, error mapping | `apps/web/test/api.*.test.ts` |
| End-to-End (E2E) | Playwright | Server startup, HTTP flows, filesystem side-effects, integrity repair | `apps/web/e2e/*.spec.ts` |

## Commands

From repo root (or `apps/web`):

```bash
# Run unit + integration tests
npm run test

# Watch mode
npm run test:watch

# Run Playwright e2e suite
npm run test:e2e
```

Playwright configuration auto-starts the Next.js dev server using a temporary repository root (`REPO_ROOT=.e2e-root`). Tests interact with the API via Playwright's `request` fixture.

## E2E Scenarios Covered
- Node CRUD lifecycle (create, list, update props, rename, position update, delete)
- Edge add / update / delete with cycle rejection
- Integrity guard repairing dangling edges after manual node file deletion
- Validation error (missing type) returns structured 400
- Rename propagation: inbound edges update their `targetId` when target node is renamed
* Structured error mapping: validation failures return `{ error: { code, message, fields[] } }` enabling field-level assertions.

## Repository Root Isolation
The E2E suite uses a shared directory `.e2e-root` and cleans node/index artifacts between tests via `resetRepoRoot()`. Parallel workers are disabled (workers=1) to avoid shared global state collisions (Ajv schema registry + `process.env.REPO_ROOT`). Future enhancement: inject repo root context per test worker to enable parallelization.

## File Structure Expectations
- Node files: `nodes/<id>.json`
- Index file: `.awb/index.json`
- Test helper may copy schemas to `.e2e-root/schemas/nodes` so validation works in isolation.

## Adding New Tests
### Unit
1. Co-locate `<module>.test.ts` beside implementation OR place in `test/` folder if cross-cutting.
2. Use deterministic inputs; avoid relying on existing filesystem state.
3. Mock file operations only if logic under test is orthogonal to persistence.

### API Integration
1. Spin up Next.js test server (Vitest environment already handles imports).
2. Call route handlers via fetch to `/api/...` using in-memory repo root override (`REPO_ROOT` env).
3. Assert JSON shape, status codes, and side-effect files.

### Playwright E2E
1. Add a new spec in `apps/web/e2e/`. Name with concise scenario (e.g. `rename-propagates-edges.spec.ts`).
2. Use `test.beforeEach(async () => { await resetRepoRoot(); });` for clean slate.
3. Use the provided `request` fixture for HTTP; avoid spinning selenium-style UI until UI surfaces exist.
4. Keep tests < 400ms where possible; prefer API flows over UI until UI is implemented.

## Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Playwright timeout starting server | Port already in use (3000) | Kill rogue Node process; rerun |
| 400 on Task creation in tests | Missing required `props.title` in `Task` schema | Include `{ props: { title: '...' } }` |
| Ajv duplicate schema error | Schema recompiled with same `$id` | Already mitigated (idempotent compile); restart if persists |
| Tests slow / hanging | Accumulated `.e2e-root` artifacts | Delete `.e2e-root` manually and rerun |

## Coverage & Future Work
Planned enhancements:
- Parallel-safe E2E via per-worker repo roots + dynamic ports
- Index corruption & rebuild scenario test (ties to remaining PBI-07 work)
- CI pipeline integration (GitHub Actions) uploading Playwright traces on failure
- README Testing section referencing this guide
- Performance smoke test: create 200 nodes / 400 edges under time threshold
- Undo/Redo functional tests (PBI-19) once ring buffer implemented (linear chain, capacity eviction)
- Snapshot create/list/restore dry-run tests (PBI-20)

## Performance Targets (Initial)
- E2E suite total < 15s (currently ~3–4s)
- Single CRUD test < 400ms
- Integrity repair operation < 250ms for small graphs (heuristic)

## Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Unit test | `*.test.ts` | `nodeRepo.test.ts` |
| E2E test | `*.spec.ts` | `rename-propagates-edges.spec.ts` |

## Environmental Variables
| Variable | Purpose | Default in Tests |
|----------|---------|------------------|
| `REPO_ROOT` | Base path for file repo operations | `.e2e-root` for Playwright, bespoke temp for some unit tests |

## Adding New Schemas
When adding a new node schema under `apps/web/schemas/nodes/*.schema.json`, the loader will auto-pick it up. For E2E, ensure it copies into `.e2e-root/schemas/nodes` on first run (handled by helper). If validation fails unexpectedly, run unit schema tests to confirm schema shape.

## When to Use Which Layer
- Pure logic change → Unit test
- API contract / status codes → API integration test
- Cross-resource flow or filesystem integrity → Playwright E2E
- UI rendering & interaction (future) → Playwright with page interactions

## Glossary
- Integrity Guard: Scans for dangling edges (targets missing) and prunes them.
- Dangling Edge: Edge whose `targetId` file no longer exists.
- Props Hash: SHA-1 hash stored in index for potential caching & change detection.

---
_Last updated: 2025-09-12_
