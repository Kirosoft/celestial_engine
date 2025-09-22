# PBI-32 Execution & Data Exchange Refactor

## Goal
Refactor the execution subsystem to use a generic, schema-driven node/graph interface that removes hard-coded branching on specific node types (e.g. ChatNode, LogNode, LLM). Establish unified contracts for inputs, outputs, emissions, and side‑effects so that only the registered executor functions contain node‑specific logic. All other orchestration (buffering, propagation, history/log augmentation, implicit variable mapping) becomes declarative and extensible.

## Motivation
Current `execution.ts` mixes concerns:
- Propagation logic is tightly coupled to concrete node types (ChatNode, LogNode, LLM) with inline conditionals.
- Multi-input handling is ad hoc: `latest` picks only the last payload per port; there is no normalized access pattern for full bundles, accumulation, or windowing.
- History side-effects (chat assist replies, log capture) occur inside the propagation loop, violating separation of concerns and impeding testability.
- Implicit variable derivation for LLM prompt building scans all nodes/edges each execution, combining concerns of data shaping and model invocation.

This increases risk of regression when new node types are added and makes it harder to introduce features like batching, streaming, retry policies, or pluggable middlewares.

## High-Level Objectives
1. Introduce a formal Graph Data Interface (GDI) describing nodes, ports, edges, payload envelopes, and emission events.
2. Replace hard-coded type checks with capability flags / behaviors declared in node metadata (schema extensions or a registry).
3. Provide a unified Input Access API supporting patterns: latest, all, first, count, reduce, window(N), since(ts), and typed/coerced views.
4. Move side-effect behaviors (chat history append, log capture) into pluggable middlewares registered by capability rather than node type.
5. Standardize emission: executor returns either structured `emissions` or `outputs` map; propagation layer enqueues and processes via a middleware pipeline.
6. Support future features seamlessly: streaming tokens, backpressure, delayed/batch execution, cancellation.

## Non-Goals (This PBI)
- Implement streaming token support (design hooks only).
- Introduce persistent queue or distributed execution.
- Implement full undo/redo of emitted data.

## Functional Requirements
1. Generic Node Descriptor: Each node type exposes a `NodeCapabilities` object (derived from schema or sidecar registry) including flags like `receivesHistory`, `logsInputs`, `autoExecuteOnInput`, `acceptsMultipleInputs`, `maxBuffer`.
2. Middleware Pipeline: A sequence of functions executed on each emission event: (a) buffer write, (b) capability side-effects (history/log), (c) auto-exec scheduling, (d) diagnostics instrumentation.
3. Emission Envelope: `{ id, fromNodeId, fromPort, toNodeId, toPort, value, ts, meta }` canonical shape.
4. Input Buffer Abstraction: Provide `InputBufferStore` interface supporting operations:
   - `append(port, envelope)`
   - `getLatest(port)`
   - `getAll(port)`
   - `slice(port, offset, limit)`
   - `window(port, n)`
   - `since(port, ts)`
   - `reduce(port, fn, seed)`
   - Enforce per-port or per-node max lengths (evict oldest).
5. Execution Context Upgrade: Executors receive `ctx.inputs` as an `InputAccessor` object with above methods instead of raw arrays; `ctx.latest` remains as convenience (internally backed by accessor).
6. Capability Side-Effects:
   - Chat capability: On emission received from a node with `emitsConversationRole='assistant'`, append message to target with `receivesHistory` capability.
   - Log capability: On any emission into a node with `logsInputs`, append classified log entry.
   - (Future) Metrics capability: Aggregate counts / latency.
7. Removal of Node-Type Conditionals: No `if (target.type === 'ChatNode'| 'LogNode')` in core emission path. All replaced by capability-driven middlewares.
8. Auto-Execution Scheduling: Nodes with `autoExecuteOnInput` trigger `runNode` after middleware side-effects complete. Depth / repetition guard preserved.
9. Deterministic Ordering: Emission processing order is FIFO per source emission. Middlewares must not reorder envelopes.
10. Diagnostics Capture: Each middleware can add structured diagnostics; `runNode` aggregates them.
11. Backward Compatibility: Existing tests (chat pipeline, log integration) pass with minimal changes (test harness may adapt to new interface names but behavioral outputs identical).

## Data Contracts
### NodeCapabilities (example)
```ts
interface NodeCapabilities {
  type: string;                 // node type name
  autoExecuteOnInput?: boolean; // run executor after new input
  receivesHistory?: boolean;    // append inbound assistant/user messages
  logsInputs?: boolean;         // keep a log of inbound emissions
  assistantEmitter?: boolean;   // emissions treated as assistant messages
  maxInputBuffer?: number;      // per-port cap
  custom?: Record<string, any>; // extension bag
}
```

### EmissionEnvelope
```ts
interface EmissionEnvelope {
  id: string;           // nanoid
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;       // for future port mapping (currently same as fromPort)
  value: any;
  ts: number;
  meta?: Record<string, any>;
}
```

### InputAccessor
```ts
interface InputAccessor {
  latest(port: string): any | undefined;
  all(port: string): EmissionEnvelope[];
  window(port: string, n: number): EmissionEnvelope[];
  since(port: string, ts: number): EmissionEnvelope[];
  reduce<T>(port: string, fn: (acc: T, env: EmissionEnvelope)=>T, seed: T): T;
  ports(): string[];
}
```

## Architecture Overview
1. Registry: `capabilityRegistry: Map<string, NodeCapabilities>` populated at startup (derivable from schema `x-capabilities` extension or a static file).
2. Propagation Flow:
   - Executor (or manual trigger) emits logical outputs via `ctx.emit`.
   - `emitOutputs(emissions[])` resolves outgoing edges (data & control kinds) and constructs envelopes.
   - For each envelope, run `processEmission(envelope)`:
     a. Write to buffer store.
     b. Run capability middlewares (history, log, metrics) referencing target capabilities.
     c. If target.autoExecuteOnInput → schedule `runNode` (depth guard).
     d. Collect diagnostics.
   - Cascading emissions handled by queue (BFS) to avoid unbounded recursion.
3. Input Buffer Store Implementation: Replace ad-hoc nested object with class `InMemoryInputBufferStore` implementing eviction.
4. Side-Effect Middlewares:
   - `historyMiddleware(envelope, targetCaps, targetNode)`
   - `logMiddleware(envelope, targetCaps, targetNode)`
   - Each returns optional diagnostics array.
5. Execution Context Construction uses accessor wrapper over buffer store for that node at invocation time.

## Execution Scenarios & Semantics
Treat each executor invocation like handling a webhook event: a single triggering (flow) envelope initiates a run; data inputs provide a snapshot context.

### Input Categories
1. **Flow (Control) Inputs**
   - Represent upstream completion / sequencing edges.
   - Exactly one flow input envelope triggers a run (exposed as `ctx.trigger`).
   - Other eligible flow parents that did not emit are ignored for that run.
2. **Data Inputs**
   - Provide referenceable state (histories, logs, configs, prior outputs, datasets, cached model responses, file blobs).
   - Any number of data inputs can participate simultaneously.

### Prefetch vs Direct Payload
- Flow trigger payload is already realized – no prefetch needed for that specific value.
- Data inputs may declare `prefetch: true` (future schema extension) or be implicitly required via variable mapping; these are materialized before executor call to form a deterministic snapshot.

### Multi-Input Resolution Rules
1. Single flow trigger per execution → `ctx.trigger` (with `triggerKind`).
2. All currently buffered data inputs populate the `InputAccessor` (latest variants, windowing, etc.).
3. Snapshot immutability: late-arriving envelopes during execution queue for a subsequent run; the active accessor view is frozen.
4. Missing required data port (declared via capability/schema) produces diagnostic `data_missing` (policy default: warn, continue).
5. Concurrent flow emissions enqueue FIFO; each produces its own execution with isolated `ctx.trigger`.

### Execution Lifecycle
1. Receive trigger envelope (flow/manual/scheduled).
2. Determine required data ports; prefetch where needed.
3. Build `ExecutionContext` including `InputAccessor`, `ctx.trigger`, `triggerKind`, `vars` (prepared variable map).
4. Invoke executor (pure function relative to provided context).
5. Collect returned emissions; enqueue for propagation.
6. Apply middlewares (history, log, metrics) before scheduling downstream auto-exec nodes.

### Context Additions
```ts
interface ExecutionContext {
  // existing / planned fields
  trigger?: EmissionEnvelope;                // the single flow/control envelope
  triggerKind?: 'flow' | 'manual' | 'scheduled';
  vars?: Record<string, any>;                // derived variable map (data + computed)
}
```

### Additional Acceptance Criteria (Scenarios)
- Scenario: Multiple data inputs + one flow trigger ⇒ executor sees all data via accessor, only one `ctx.trigger` present.
- Scenario: Two rapid flow triggers ⇒ two queued executions processed FIFO; diagnostics show distinct trigger envelope ids.
- Scenario: Required data port absent ⇒ execution proceeds, `data_missing` diagnostic emitted (unless policy overridden to block).
- Scenario: Late data arrival during execution ⇒ not visible inside current run; appears in subsequent run after the next trigger.

## Performance Considerations
- O(1) append with optional ring-buffer strategy for capped history.
- Avoid full graph scans inside executor (move implicit variable mapping into pre-exec planning middleware that builds a context map once per run, cached per runId if needed).
- BFS emission queue prevents deep stack recursion and enables future concurrency control.

## Edge Cases & Error Modes
- Circular auto-exec loops still guarded by runChain depth and repetition limit.
- Over-capacity buffers evict oldest entries deterministically (emit diagnostic event `buffer_evicted`).
- Missing capabilities entry → treated as baseline (no side-effects, may still auto-execute if executor exists and default policy chosen).
- Middleware error surfaces as diagnostic; propagation continues (fail-open) unless marked fatal.

## Migration Strategy
1. Introduce new files (buffer store, capabilities, middlewares) without removing existing logic.
2. Implement processEmission + queue and adapt `emitFrom` to delegate.
3. Move Chat/Log side-effects into middlewares; remove conditionals.
4. Update `runNode` to build `InputAccessor`.
5. Adjust tests to reference `history` and `log` behaviors (should remain unchanged externally) and validate new diagnostic events.
6. Remove deprecated code paths after parity confirmed.

## Acceptance Criteria
1. No direct `if (target.type === 'ChatNode'| 'LogNode')` in core emission path.
2. Chat pipeline test passes; assistant replies still appended and logged.
3. Log integration test passes; log entries appended via middleware.
4. Multi-input test demonstrating window(3) returns last 3 inputs for a port.
5. New unit tests for InputBufferStore eviction and accessor API.
6. Emission recursion replaced by explicit queue with depth guard; stack does not grow with long chains (add test with 10 chained nodes to assert no overflow and correct order).
7. Diagnostics include at least: `buffer_append`, `buffer_evicted` (when applicable), `history_appended`, `log_appended`, `auto_exec_scheduled`.
8. LLM executor file no longer scans full graph directly for implicit variables; a preparatory middleware produces a `ctx.vars` or similar map (phase 2 stub allowed: extract existing logic into helper invoked pre-execution, flagged for further refactor if large).
9. Performance benchmark (simple script) shows no >10% regression for existing test pipeline (measured by total test runtime or custom micro-benchmark).

## Implementation Slices
1. Capability & Schema Extension
2. Buffer Store + Accessor
3. Emission Queue & processEmission
4. Middlewares (History, Log)
5. Refactor emitFrom → emitOutputs + queue
6. Context Construction & Executor Changes
7. Variable Mapping Extraction (LLM) [Phase 1 wrapper]
8. Tests (unit + integration additions)
9. Cleanup & Deprecation Removal

## Risks
- Hidden coupling in tests expecting internal console log strings.
- Potential race if future async middlewares mutate target props after auto-exec (mitigate with sequential await ordering).
- Complexity creep if variable mapping refactor attempted fully now (kept partial).

## Deferred / Future Enhancements
- Streaming middleware (token events)
- Persistent buffer (disk or IndexedDB)
- Backpressure & rate limiting
- Capability-driven UI affordances (auto-exec badge)
- Metrics export (Prometheus)

## Open Questions
- Should buffer eviction policy be configurable (drop oldest vs reject new)? (Default: drop oldest)
- Do we need per-edge vs per-port buffering semantics? (Phase 1: per-port aggregate)
- Should diagnostics be persisted or ephemeral? (Phase 1: ephemeral only)

## Checklist
- [ ] Add capability registry
- [ ] Implement InMemoryInputBufferStore + tests
- [ ] Implement InputAccessor wrapper + tests
- [ ] Add emission queue and processEmission orchestrator
- [ ] Implement history & log middlewares
- [ ] Refactor emitFrom to new pipeline
- [ ] Update runNode for accessor & diagnostics merging
- [ ] Extract LLM variable mapping pre-exec helper
- [ ] Update / add tests (buffer eviction, window, queue depth)
- [ ] Remove old conditional code
- [ ] Update PBIs referencing old execution internals
- [ ] Document new interfaces in README / developer guide

Status: Draft
Owner: (assign)
Created: 2025-09-22
