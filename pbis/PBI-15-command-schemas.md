## PBI-15: Command Schema Set

Goal
----
Define a versioned JSON Schema collection for all command envelopes and action payloads to enable validation, tooling, and future replay compatibility.

Description
-----------
Introduce a `schemas/commands/` directory containing:
1. `command-envelope.schema.json` – common envelope: `{ id, ts, type, expected_version?, idempotency_key?, actions: Action[] }`.
2. Individual action schemas (e.g., `add_node`, `update_node`, `rename_node`, `delete_node`, `add_edge`, `update_edge`, `remove_edge`, `move_node`, `snapshot_graph`).
3. `$id` fields for each schema (namespaced `awb://commands/<action>`).
4. Schema index manifest for fast loading & AJV pre-compilation.

Acceptance Criteria
-------------------
- All command/action schemas validate with AJV (no unresolved `$ref`).
- Adding a node with missing required fields fails validation with structured error.
- Invalid `expected_version` is not rejected at schema layer (semantic check deferred to dispatcher).
- Schemas are documented in README section (auto-generated table of actions → description → schema path).
- Versioning strategy defined (simple `x.y` in envelope or manifest) with upgrade note.

Tests
-----
- Unit: Iterate all schemas → compile with AJV → assert success.
- Negative: Provide malformed command JSON; expect `400` with path + keyword details.
- Snapshot: Serialize schema manifest; detect accidental breaking removals in PR diff.

Dependencies
------------
- Existing node & edge schemas (Phase 1).

Out of Scope
------------
- Semantic validation (handled in dispatcher PBI-16).
- Schema migration tooling.

Risks / Mitigations
-------------------
- Risk: Schema `$id` collisions → enforce naming linter.
- Risk: Over-fitting early commands → keep minimal required fields, allow extensible `meta` object.

## Implementation Status
Not started. No command schema directory or files present yet. Current system validates only node schemas (Phase 1). This PBI will bootstrap Phase 2 command infrastructure.

## Outstanding / Deferred
- Implement schema files & manifest loader
- Add AJV compilation tests & negative validation cases
- Provide README/docs section enumerating command/action schemas
