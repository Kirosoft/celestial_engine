---
id: PBI-15
title: Command Schema Set
phase: 2
status: not-started
priority: medium
estimate: 5
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-05, PBI-12]
---

## Goal
Define a versioned JSON Schema collection for all command envelopes and action payloads to enable validation, tooling, and replay compatibility.

## Description
Introduce a `schemas/commands/` directory containing:
1. `command-envelope.schema.json` – common envelope: `{ id, ts, type, expected_version?, idempotency_key?, actions: Action[] }`.
2. Individual action schemas (add/update/rename/delete node; add/update/remove edge; move_node; snapshot_graph).
3. `$id` fields namespaced `awb://commands/<action>`.
4. Schema manifest + loader for fast AJV pre-compilation.

## Business Value
Early structural validation reduces runtime errors; schemas double as machine-readable documentation enabling future tooling (generation, replay safety, diffing).

## Acceptance Criteria
- All command/action schemas compile (no unresolved `$ref`).
- Missing required field in an action yields structured validation error (400 with errors[]).
- `expected_version` semantic mismatches not rejected at schema layer (dispatcher handles).
- README documents each action with description + schema path.
- Versioning approach documented (envelope version or manifest version field).

## Definition of Done
- Schemas + manifest committed & imported by loader
- AJV compile test + negative tests present
- README / docs updated

## Implementation Checklist
- [ ] Create `schemas/commands/` directory
- [ ] Envelope schema with `$id`
- [ ] Node action schemas (add/update/rename/delete)
- [ ] Edge action schemas (add/update/remove)
- [ ] Move node action schema
- [ ] Snapshot graph action schema
- [ ] Manifest file & loader module
- [ ] AJV pre-compilation test
- [ ] Negative validation tests (malformed envelope/action)
- [ ] README docs section
- [ ] Versioning strategy note

## Tests
1. Iterate & compile all schemas (expect success)
2. Malformed action (missing required) → 400 with path+message
3. Snapshot manifest to detect breaking removals

## Dependencies
Relies on existing node & edge schemas (Phase 1).

## Out of Scope
- Semantic/authorization checks (dispatcher PBI-16)
- Migration tooling for schema evolution

## Risks / Mitigations
- `$id` collision risk → add simple uniqueness test (future)
- Scope creep early → keep action schemas minimal & extensible via `meta`

## Implementation Status
Not started. No `schemas/commands` directory present; current validation limited to node schemas.

## Outstanding / Deferred
- `$id` uniqueness test
- Schema diff tooling
- Potential codegen for TypeScript action types
