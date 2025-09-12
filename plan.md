# Agentic Workflow Builder – Implementation Plan (v0.1 -> v0.1+)

## 0. Purpose & Scope
This plan operationalizes the Functional & Technical Specification (v0.1) into phases, workstreams, concrete deliverables, and validation checkpoints required to ship the **Repo‑Local MVP** and establish foundations for later Cloud mode and advanced features.

Covers:
- File‑backed graph system (nodes + edges) with command/event model.
- Next.js (dev) + Hono packaged server + SPA distribution.
- Node type schemas & validation, command DSL, and UI authoring experience.
- LLM + OpenAPI (tool) provider integration (local only; secrets abstracted for future Key Vault).
- Git integration (local commits) and minimal DX CLI.

Out of scope (defer/post‑MVP): multi‑tenant auth, realtime collab, durable queue execution, cloud persistence, advanced eval harness.

## 1. Guiding Principles
1. Files are the source of truth (no hidden DB state).
2. Every structural mutation is a validated command → event → file diff.
3. Idempotency & integrity over speed; correctness first.
4. UI surfaces schema‑driven forms; no hardcoded per‑type property logic.
5. Keep packaging frictionless: one binary / one Docker image / one npm CLI.

## 2. Domain Model Snapshot (MVP Realization)
- Node JSON file shape (per file `nodes/<id>.json`): `{ id, type, name, position, props, inputs[], outputs[], edges?: { out: EdgeOut[] } }`.
- Edge is stored on source node only (fan‑out). Global read reconstructs graph.
- Command envelope & action payload schemas (JSON Schema collection under `schemas/commands/`).
- Graph version = monotonically incrementing on accepted command; persisted in `.awb/index.json`.

## 3. Workstreams
1. Core FS Layer (`FileRepo`, safe path ops, atomic writes).
2. Node & Edge Repository (list/read/write/rename/delete + integrity checks).
3. Command Processing Pipeline (validation + event emission + apply + versioning + audit log).
4. UI Canvas & Editing (React Flow integration + schema‑driven inspector + command console).
5. Provider Integrations (OpenAI compatible + OpenAPI import → Tool Call node schemas).
6. Git Integration (status, diff, commit, branch, push optional).
7. CLI & Packaged Server (Hono + embedded SPA + init scaffolder).
8. Validation & Testing Framework (AJV loading, golden tests, replay harness seed).
9. Distribution (Dockerfile, optional Bun compile, README generation).
10. Observability & Logging (structured logs for commands/runs; minimal OTEL hooks placeholder).

## 4. Phase Breakdown & Milestones Mapping
### Phase 1: Foundations (aligns with M0 prerequisites + schema bedrock)
- Implement `FileRepo` and path sanitizer.
- Implement `NodeRepo` with: create (random id), read, list, update, rename (propagate edges), delete.
- Edge operations: add/remove/update (validate node IDs & prevent self‑loops initially).
- JSON Schema loader for node types (`schemas/nodes/*.schema.json`).
- Basic AJV validator wrappers (caching compiled schemas).
- Seed schemas: `LLM`, `Plan`, `Task`, `ToolCall` (minimal props), `Router`, `Merge`, `Code`, `GitHubInput`, `GitHubOutput`, `Eval`.
- Graph index builder `.awb/index.json` (node id → file path; type; name; hash of props for future cache key).

Exit Criteria: Can create nodes via API, list, update props with validation, set positions, connect edges, and rename without dangling references.

### Phase 2: Command & Event Layer
- Define command schema set (envelope + action payload schemas).
- Implement command dispatcher: validate envelope + action; check idempotency key + expected_version.
- Event derivation & append (JSON lines log `.awb/events.log`).
- Apply functions (pure) to produce file mutations; wrap in transaction (all/none).
- Undo/redo: maintain in‑memory ring buffer of last N (e.g., 50) applied commands with inverse command generator.
- Snapshot: `POST /api/graphs/:id/snapshots` → copies all node files to `.awb/snapshots/<ts>-<label>`. Register snapshot event.

Exit Criteria: All canvas mutations route through command API (except maybe initial bootstrap). Replay of last 10 commands reproducible.

### Phase 3: UI Authoring Experience
- React Flow canvas with node placement, drag, connect, edge label (kind toggle flow/data).
- Toolbox fetches node type schemas (title, type) for Add Node.
- Inspector auto‑generates form via RJSF for `props`.
- Command Console panel: editable JSON, validation feedback, submit → events log view.
- Logs Panel placeholder (streams later) showing last run output or mock.

Exit Criteria: User can build a small graph (5–10 nodes) end‑to‑end with no manual file edits.

### Phase 4: Plan Node Design-Time Materialization
- Implement Plan node runtime (mock first → integrates LLM later) that given goal/context returns `commands[]`.
- Diff Modal: show planned add/connect/update operations before apply.
- Apply path: batch validate commands; show aggregated diff summary; atomic commit.

Exit Criteria: Playing a Plan node adds Task nodes & edges after user confirmation.

### Phase 5: LLM & Tool Providers
- Provider config storage (`.awb/providers/<id>.json`).
- OpenAI-compatible client wrapper (supports streaming, tool/function calls placeholder fields).
- LLM Node execution route: `POST /api/nodes/:id/play` (live/design param) executing model call; stream tokens SSE.
- OpenAPI import: upload spec → parse operations → generate ToolCall node schemas persisted under `schemas/nodes/generated/`.

Exit Criteria: Simple LLM completion appears in Logs Panel; user can import an OpenAPI spec and instantiate a ToolCall node.

### Phase 6: Git Integration
- Implement `GitRepo` abstraction using `simple-git`.
- APIs: status, diff (per path), commit (stage specified node files), branch list/create/switch.
- Commit from GitHub Output Node (simulate file modifications and commit message templating).

Exit Criteria: User can commit graph/node changes and view diffs pre-commit.

### Phase 7: Packaging & Distribution (Milestone M0 completion)
- Hono server parity routes for nodes, edges, schemas, commands, providers.
- SPA build pipeline (Vite) for UI; copy to server `public/`.
- CLI commands: `init`, `serve`, `open`, `doctor`.
- Optional Bun single-file binary build script.
- Dockerfile publishing workflow.

Exit Criteria: `npx awb serve --repo .` works in a clean repo producing functional UI & APIs.

### Phase 8: Testing & Hardening
- Golden node tests (fixtures under `tests/nodes/`).
- Command schema validation tests & idempotency re-apply test.
- Edge integrity test: after random rename/delete operations no orphan edge remains.
- Snapshot/undo/redo tests.
- Basic performance sanity: create 200 nodes, 400 edges under 3s load & <150MB RSS.

Exit Criteria: CI passes; quality gates met; acceptance criteria checklist all green.

## 5. Detailed Deliverables Matrix (Spec → Plan Mapping)
| Spec Section | Requirement | Plan Section | Notes |
|--------------|-------------|--------------|-------|
| 1 | Git-aware local web app | Phase 1,6,7 | FS + Git + packaging |
| 2 | DAG Graph model | Phase 1 | Edges validated; cycle prevention in Phase 2 (commit gate) |
| 3 | Design vs Live runs | Phase 4,5 | Plan node design-time ; live LLM play |
| 4 | Initial node types | Phase 1 seed schemas | Minimal props subset allowed |
| 5 | Command DSL idempotent | Phase 2 | Envelope + dispatcher |
| 6 | LLM & OpenAPI integration | Phase 5 | Streaming later can defer partial |
| 7 | GitHub integration | Phase 6 | Local commit first |
| 8 | Single process runtime | Phases 1–7 | Next.js dev / Hono prod |
| 9 | Filesystem primary store | Phase 1 | .awb index & node files |
| 10 | API surface endpoints | Phases 1–6 | Routes grouped by resource |
| 11 | UI Canvas, Inspector, Console | Phase 3 | RJSF + React Flow |
| 12 | Observability basics | Phase 8 | Structured logs, placeholder OTEL |
| 13 | Undo/redo, snapshots | Phase 2 | Command history + snapshot copy |
| 14 | Testing strategy | Phase 8 | Golden + replay |
| 15 | Secrets abstraction (future Key Vault) | Phase 5 (scaffold) | MVP local secrets stub |
| 16 | Data model types | Phase 1,2 | Node/Edge/Command TS interfaces |
| 17 | Example flows (Plan, GitHub write) | Phases 4,6 | Verified via demo script |
| 18 | Local dev commands | Phase 7 | CLI + docs |
| 19 | Directory structure | Phase 7 init | Scaffold ensures layout |
| 20 | JSON Schemas | Phase 1,2 | Nodes + commands |
| 21 | Roadmap (post) | Appendix | Not implemented now |
| 22 | Open questions | Appendix | Track as issues |
| 23 | Acceptance Criteria list | Phase 8 gating | Formal test mapping |
| 24 | Deployment (Azure optional) | Future | Out of MVP path |
| 25 | Server + CLI scaffolding | Phase 7 | Hono + SPA |
| 26 | UI components (toolbox etc.) | Phase 3 | Implemented per design |
| 27 | Milestones | Sections 4,7 | Direct mapping |
| 28 | Distribution modes | Phase 7 | CLI, Docker, Binary |

## 6. Architectural Components (Implementation Notes)
### 6.1 Storage & Index
- Safe join: prevent `..` escapes; reject absolute writes outside root.
- Atomic write: write temp file + fs.rename.
- Index builder scans `nodes/*.json` → updates `.awb/index.json` with { id, type, name, mtime, hash(props) }.
- Eventual index update strategy: synchronous on mutation for MVP.

### 6.2 Node File Conventions
- Filename == id; rename moves file + updates any source edges referencing old id.
- Outgoing edges kept in node: `edges.out: [{ id, targetId, kind, sourcePort?, targetPort? }]`.
- Edge ID stable across rewrites; generate via nanoid.
- Prevent cycles initially by DFS when adding edge (performance fine for MVP sizes).

### 6.3 Command Processing
- Flow: API receives command list → validate each (schema + semantic) → lock graph version → apply reducers → write files → append events → bump version.
- Idempotency store: ring buffer/store of last N idempotency keys with payload hash (in `.awb/idempotency.json`).
- Inverse command mapping for undo (e.g., `add_node` ↦ `remove_node`, `move_node` ↦ previous position).

### 6.4 Runtime Execution (LLM, Plan)
- Plan Node execution returns a preview object `{ commands, summary }` without auto-applying.
- LLM Node uses streaming fetch; SSE to UI (fallback: buffered).
- ToolCall Node invocation path: build request from props + inputs, map provider auth.

### 6.5 Git Integration
- `diff(path)` uses raw file contents vs HEAD; for untracked treat as full add.
- Commit batching: stage only touched node + index/event files unless user selects broader scope.

### 6.6 CLI Design
- Single entry `awb` with subcommand parser (minimal custom parsing or a tiny arg lib).
- `init` seeds example schemas & example nodes.
- `doctor` checks for missing required directories & write perms.

### 6.7 Packaging & Deployment
- Hono server exports `fetch`; Bun build → single binary (optional). Docker multi-stage to embed built SPA.
- SPA build artifact copied to `apps/server/public/` directory; server falls back to index.html for client routes.

### 6.8 Validation Strategy
- Load all schemas at startup; on change (dev) hot reload.
- AJV options: `allErrors:false`, `removeAdditional:'failing'` for security when appropriate.

## 7. Risk Register & Mitigations
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Command replay drift (non-deterministic reducer) | Corrupt history | Low | Keep reducers pure; unit test replay equivalence |
| Edge cycle detection performance | Slow edge adds in dense graphs | Low | Limit graph size MVP; optimize with adjacency map later |
| Schema explosion for tool-generated nodes | Memory + startup latency | Medium | Lazy-load generated schemas; index manifest |
| LLM provider latency blocks UI | Poor UX | Medium | Streaming SSE; cancellable fetch controller |
| File corruption on crash mid-write | Lost node | Low | Atomic temp + rename; periodic snapshot |
| Undo stack divergence after external file edits | Inconsistent state | Medium | Watcher invalidates undo stack on external change |
| Large OpenAPI spec parsing cost | UI stall | Medium | Parse in worker (future) / chunk loading |

## 8. Testing Matrix (Mapping to Acceptance Criteria)
| Area | Tests |
|------|-------|
| Node CRUD | create/list/update/rename/delete with schema validation |
| Edge Ops | add/remove/update; cycle rejection test |
| Commands | schema validation, idempotent reapply (no version bump) |
| Undo/Redo | sequence apply & inverse correctness |
| Snapshot | create + restore: file set diff zero |
| Plan Node | mock generation produces deterministic command list |
| LLM Node | streaming output shape & abort path |
| Git Ops | diff & commit reflect file state changes |
| Performance | 200 nodes/400 edges load < 3s |

## 9. Observability & Logging
- Structured JSON logs: `{ ts, level, eventType, commandId?, nodeId?, graphVersion }`.
- Event log rotation policy (size > 5MB rotate to `.old`).
- Future OTEL: wrap provider/LLM calls with spans; tag runId, graphId.

## 10. Delivery Timeline (Indicative)
| Week | Focus | Key Outputs |
|------|-------|-------------|
| 1 | Phase 1 | Node/Edge repos, schemas, validator, basic APIs |
| 2 | Phase 2 | Command dispatcher, events, undo/redo, snapshots |
| 3 | Phase 3 | Canvas, toolbox, inspector, command console |
| 4 | Phase 4 & 5 | Plan node design-time + LLM provider integration |
| 5 | Phase 6 | Git integration & GitHub output node demo |
| 6 | Phase 7 | CLI, Hono packaged server, SPA build & Docker |
| 7 | Phase 8 | Tests, hardening, docs, acceptance checklist |

## 11. Appendices
### 11.1 Post‑MVP Backlog Tracking
- Lift phases into GitHub project board; convert each milestone item (M0-01 etc.) to issues.
- Tag open questions as `discussion` and set decision deadlines.

### 11.2 Open Questions Carried Forward
- Per-node secrets override? (Await usage signals.)
- Plan node partial updates vs full generation strategies.
- Standard artifact storage layout for future cloud mode.

### 11.3 Definition of Done (MVP)
- All Acceptance Criteria (Spec §23) validated by automated or semi-automated test.
- No TODO comments referencing MVP scope remain.
- Running `awb serve` in fresh repo after `init` yields zero errors and functional authoring.

---
Generated from spec v0.1 on: 2025-09-12

## PBI-14: Playwright End-to-End Tests (Implemented)

Status: Complete (Initial coverage)

Scope Delivered:
- Added Playwright test harness (`playwright.config.ts`) with dev `webServer` starting Next.js; serialized workers to avoid shared global state issues (Ajv schema cache + environment root).
- Implemented `resetRepoRoot` helper providing deterministic cleanup while preserving copied node schemas inside `.e2e-root/schemas/nodes`.
- CRUD lifecycle test validates: create → list (integrity scan) → update props → rename (edge retarget not needed here) → position update → delete → filesystem & index emptiness assertions.
- Edge lifecycle/integrity test: add/update edge, cycle rejection, deletion workflow, integrity repair after manual node file removal (dangling edge pruned), re-verification.
- Validation error test ensures missing `type` returns structured 400 with domain code.
- Enhanced validator to gracefully handle duplicate Ajv `$id` registrations (idempotent schema compile) to stabilize repeated test runs.

Notable Decisions:
- Forced `workers:1` due to process-wide mutable state (Ajv registry + `process.env.REPO_ROOT`). A future refactor could inject repo root via request context or spin isolated server instances per worker for parallelization.
- Schema copy occurs only once; subsequent test resets clear node and index data without touching schema directory to reduce IO.

Future Enhancements:
1. UI-driven tests once a canvas/inspector UI is implemented (currently API-level E2E).
2. Add index corruption & rebuild scenario after implementing corruption detection (ties to remaining PBI-07 work).
3. Capture traces on all failures in CI and upload as artifacts.
4. Performance smoke: measure time to create N nodes & edges inside Playwright (optional gating metric).
5. Parallel worker strategy using per-worker dynamic port + isolated server spawn (remove workers:1 bottleneck).

Result: Provides confidence that repository + API stack behave correctly end-to-end across core graph operations, integrity repair, and validation pathways.

2025-09-12 Enhancement: Added rename propagation test ensuring that when a node with inbound edges is renamed, all source nodes' outgoing edge targetIds are updated to the new id (no stale references). Strengthens correctness guarantees around node identity changes.
