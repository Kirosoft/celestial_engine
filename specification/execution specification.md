# Node Execution Specification

Status: Draft
Date: 2025-09-15
Owner: (assign)
Version: 0.1

## 1. Overview
Every node in the graph exposes a unified `Run` / `Execute` action. Execution consumes normalized input payloads from all inbound edges, delegates work to a node-type–specific `execute` function (which may call a remote Python execution framework), then publishes produced outputs to all outbound edges, triggering input events on each downstream target node. This document defines the contract, lifecycle, data formats, error handling, and remote execution pattern.

## 2. Terminology
- **Node**: A typed unit of computation with `props`, zero or more input connections, and zero or more output connections.
- **Port**: A logical input or output label; edges connect `sourceNode:sourcePort -> targetNode:targetPort`.
- **Execution Context**: Environment object passed to `execute` containing inputs, configuration, logging, cancellation, and service adapters.
- **Payload**: JSON-serializable value transmitted along an edge.
- **Emission**: Delivery of an output payload to all edges bound to the originating output port.
- **Remote Python Runner**: Service that receives an execution spec (code + args), runs it in an isolated Python environment, and returns structured results.

## 3. Lifecycle Summary
```
User/Trigger → Schedule → Prepare Inputs → Build Context → Execute (local or remote) → Collect Outputs → Persist Node State (optional) → Emit Outputs → Downstream Input Events
```

## 4. Triggering Execution
Execution may start via:
1. Manual user action (UI button `Run`).
2. Programmatic command (CLI / API).
3. Upstream emission policy (future: auto-run on input change or batching window).

Each node has an `x-actions` entry `run` (alias `execute`) in its schema enabling generic invocation.

## 5. Input Normalization
Before calling `execute`, the runtime assembles an `inputs` object:
```
inputs: {
  <inputPortName>: Array<{ edgeId: string; sourceNodeId: string; payload: any; ts: number }>
}
```
Rules:
- All inbound edges included; if no payloads have been sent yet, port key maps to an empty array.
- Multiple emissions from the same edge accumulate (future retention policy may cap or collapse).
- Timestamp `ts` is milliseconds epoch when payload was emitted.

Optionally a convenience `latest` view:
```
latest: {
  <inputPortName>: any | undefined // most recent payload for that port
}
```

## 6. Execution Context Contract
```
interface ExecutionContext {
  nodeId: string;
  nodeType: string;
  runId: string;                  // unique per execution
  props: Record<string, any>;     // node props at start of execution
  inputs: Record<string, EdgePayload[]>;
  latest: Record<string, any>;
  emit: (port: string, value: any) => void; // buffered until Emit Phase
  logger: Logger;                 // info, warn, error
  metrics: MetricsCollector;      // increment, gauge, timing
  abortSignal: AbortSignal;       // supports cancellation
  python?: PythonRemoteAdapter;   // remote Python execution
  env: Record<string,string>;     // sanitized environment variables
  tempDir: string;                // scratch space path (if local)
}
```

## 7. Execute Function Signature
Each node type provides (directly or by registry mapping):
```
async function execute(ctx: ExecutionContext): Promise<ExecuteResult>
```
`ExecuteResult`:
```
interface ExecuteResult {
  outputs?: Record<string, any>;    // port -> payload (alternative to calling ctx.emit)
  patchProps?: Record<string, any>; // shallow merge into node props if provided
  diagnostics?: Array<{ level: 'info'|'warn'|'error'; message: string; data?: any }>;
  error?: string;                   // terminal error message (if thrown, runtime converts)
  durationMs?: number;              // optional self-reported time
}
```
Behavior:
- If both `ctx.emit` calls and `outputs` provided, runtime unions them (explicit `outputs` wins on key collision).
- `patchProps` applied (persisted) only if validation passes.

## 8. Remote Python Execution Pattern
Nodes that leverage Python delegate heavy logic to a remote service via `ctx.python.run(spec)`.

### 8.1 Spec
```
interface PythonExecutionSpec {
  entrypoint: string;               // module:function or script path
  code?: string;                    // optional inline code override
  args?: Record<string, any>;
  files?: Array<{ path: string; content: string }>;
  timeoutMs?: number;
  venv?: string;                    // named environment (model / libs)
  requirements?: string[];          // additional pip deps (resolved/cached)
}
```
### 8.2 Adapter
```
interface PythonRemoteAdapter {
  run(spec: PythonExecutionSpec, options?: { signal?: AbortSignal }): Promise<PythonResult>;
}
interface PythonResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  returnValue?: any;  // JSON-serializable
  artifacts?: Array<{ name: string; uri: string; mime?: string }>;
  error?: string;
  durationMs: number;
}
```
Runtime maps PythonResult to emissions:
- Primary emission port default: `output` (customizable per node)
- `returnValue` -> emitted payload
- `stdout` / `stderr` optionally appended into diagnostics

## 9. Phases Detailed
### 9.1 Scheduling
- Assign `runId`
- Record start time
- Register cancellation handle

### 9.2 Preparation
- Load node snapshot & props
- Gather input payload buffers
- Construct context, initialize Python adapter if required

### 9.3 Execution
- Invoke `execute(ctx)` with `try/catch`
- Support timeout via `AbortSignal`

### 9.4 Result Handling
- Collect emissions: from `ctx.emit` buffer + `result.outputs`
- Apply `patchProps` with validation (AJV) — on failure, drop patch and log error

### 9.5 Emission
For each `port -> value` pair:
```
create emission record: { id, runId, nodeId, port, value, ts }
append to edge payload buffers for edges whose sourcePort == port
trigger input event for each target node
```
Events dispatched (browser/global):
- `node:emitted` (detail: { nodeId, runId, port })
- `node:updated` (if props patched)

### 9.6 Completion
- Capture duration
- Emit `node:completed` or `node:failed`
- Flush metrics

## 10. Error Handling
| Scenario | Handling |
|----------|----------|
| Throw inside execute | Mark run failed; emit no outputs; dispatch `node:failed` |
| Timeout | Abort, mark failed with timeout error |
| Validation fail on patchProps | Log diagnostic, skip prop update |
| Emission serialization failure | Log error, skip that emission |

All failures produce a diagnostic record.

## 11. Concurrency & Reentrancy
- Default: single in-flight run per node. A new trigger while running yields `409 Busy` (future queue support).
- Cancellation: user action or upstream abort sets `abortSignal`; Python adapter forwards signal to remote.

## 12. Persistence
- Emitted payload history retained per edge (existing system) with configurable retention policy (future).
- Props patch persisted atomically via existing node update API.
- Optional run log appended (future PBI) capturing diagnostics + summary.

## 13. Security & Isolation
- Python execution occurs in sandboxed environment (container / micro-VM) with:
  - Network egress controlled (allowlist?)
  - Resource limits: CPU, memory, wall time
  - Ephemeral filesystem wiped after run
- Only whitelisted env vars passed into `ctx.env`.

## 14. Observability
- `logger` -> central log aggregator
- `metrics` -> counters: `node_runs_total{type=}`, `node_run_errors_total{type=}`, histograms for duration
- Run events instrumented for UI progress indicators.

## 15. Extensibility Points
- Custom adapters (e.g., GPU inference) can extend context.
- Per-node execution policy (auto-run, manual, debounce) registered in schema extension `x-execPolicy`.
- Pluggable retention strategy for input buffers.
 - Action buttons surfaced from schema `x-actions` enabling user-triggered invoke.

### 15.1 Action Buttons & Action Types
Schemas may declare an `x-actions` array, each element:
```jsonc
{
  "name": "run",            // unique within node type
  "label": "Run",           // UI label (fallback capitalize name)
  "kind": "runtime",         // "design" | "runtime" | "either"
  "description": "Execute node with current inputs"
}
```
Kinds:
- `design`: Safe during structural editing; should not depend on live external state (e.g., validate, compile, dry-run generation).
- `runtime`: Performs side-effects or remote execution; requires input buffers; may produce emissions.
- `either`: Usable in both contexts; runtime semantics favored when inputs present.

UI Behavior:
- Inspector or Node chrome renders buttons for declared actions, gating `runtime` actions if graph is in a locked/edit-only state.
- Execution dispatch path resolves action name to either the generic `execute` (for `run`) or a node-type–specific handler (future extension: multiple handlers per node type).

### 15.2 Design-Time vs Runtime Execution
Design-time execution may:
- Skip emission phase (dry-run) and instead produce diagnostics / preview outputs.
- Use a reduced Python environment or local simulation.
Runtime execution always performs full emission unless an error occurs or `dryRun` flag is explicitly provided.

Context Flag:
```
ctx.mode: 'design' | 'runtime'
```
The orchestrator sets `ctx.mode` based on the action kind and current graph state.

### 15.3 Intercept Function (Instruction Processing)
Nodes can optionally define an `intercept(payload, meta)` function allowing them to treat certain inbound payloads as internal instructions rather than standard data.

Use Cases:
- A Chat / Agent node receives a payload that encodes a graph-building instruction (e.g., JSON DSL) and synthesizes new nodes & edges using existing schemas.
- A Router node receives a control message to alter routing strategy.

Contract:
```
type InterceptResult = {
  consumed: boolean;                 // true if payload handled internally
  sideEffects?: Array<GraphMutation>; // node/edge create/update operations
  diagnostics?: Array<{ level: 'info'|'warn'|'error'; message: string }>;
};

type InterceptFn = (payload: any, meta: { edgeId: string; sourceNodeId: string; port: string; ts: number }, ctx: ExecutionContext) => Promise<InterceptResult> | InterceptResult;
```

Processing Order:
1. On inbound emission append, before buffering, orchestrator invokes `intercept` if defined.
2. If `consumed: true`, payload is not added to the normal input buffer for that port.
3. Any `sideEffects` are validated and applied (creating new nodes requires schemas to be already loaded); resulting mutations emit standard graph events.
4. Diagnostics forwarded to run log buffer (even outside a run) with pseudo `runId` prefix `intercept-<timestamp>`.

GraphMutation (conceptual):
```
interface GraphMutation {
  kind: 'createNode'|'updateNode'|'deleteNode'|'createEdge'|'deleteEdge';
  node?: { type: string; name?: string; props?: Record<string,any>; id?: string };
  edge?: { id?: string; sourceId: string; targetId: string; sourcePort?: string; targetPort?: string; kind?: string };
  patch?: Record<string,any>; // for updateNode
}
```

Security / Guardrails:
- Intercept disabled by default; enabled per node via schema extension `x-intercept: true`.
- Mutation count per intercept invocation capped (e.g., 50) to prevent runaway graph explosions.
- Optionally a feature flag or permission gate for graph-building instructions.

Failure Handling:
- If `intercept` throws, log diagnostic and fall back to normal buffering of the payload (unless an explicit `consumed: true` was already recorded before error — orchestrator treats it as not consumed on failure).
- Partial mutations: orchestrator applies in order; if one fails validation, it halts remaining and logs error diagnostic.

### 15.4 Execution & Intercept Interaction
- Intercepts may queue structural changes that influence subsequent executions (new nodes may auto-run if their policies dictate).
- Intercepts are orthogonal to standard `execute`; they do not produce emissions directly (unless a newly created node executes and emits on its own policy).
- A design-time action can leverage intercept logic to preview graph changes without committing them (future flag `dryMutations: true`).

### 15.5 Schema Extensions Summary
| Extension Key      | Purpose                                      |
|--------------------|----------------------------------------------|
| `x-actions`        | Declares action buttons / invokable actions  |
| `x-execPolicy`     | Execution policy metadata                    |
| `x-intercept`      | Enables intercept function for a node type   |
| `x-defaultOutput`  | Default emission port (optional)             |


## 16. Minimal Example
```ts
// Registry entry
registerExecutor('Code', async (ctx) => {
  const { returnValue, stdout, stderr } = await ctx.python.run({
    entrypoint: 'runner:main',
    code: ctx.props.source,
    args: { inputs: ctx.latest }
  });
  if(stdout) ctx.logger.info(stdout);
  if(stderr) ctx.logger.warn(stderr);
  return { outputs: { output: returnValue } };
});
```

## 17. Open Questions
1. Should emissions be versioned for replay? (Potential event sourcing PBI.)
2. Do we allow partial failure (emit subset) or all-or-nothing? (Currently: partial allowed.)
3. Should input buffers be pruned after successful run? (Future optimization.)

## 18. Acceptance Criteria (Spec Level)
- Standard `execute` function interface documented.
- Input normalization structure implemented.
- Emission triggers downstream input events.
- Remote Python adapter contract defined and used in at least one node executor (e.g., Code node).
- Error scenarios enumerated with handling rules.

---
END OF SPEC
