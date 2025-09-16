# PBI-30 Chat + LLM Demo Graph

## Goal
Provide a minimal runnable example graph wiring a `ChatNode` to an `LLM` node and looping the LLM output back to the chat, demonstrating bidirectional flow and action-triggered execution.

## Graph Composition
File: `nodes/ChatLLMDemo.json`
```
ChatNode-Seed (ChatNode) --(message)-> LLM-Demo (LLM) --(output)-> ChatNode-Seed (message)
```

## Execution Flow
1. User enters a message in ChatNode and clicks `Send` (schema action `send`).
2. ChatNode appends message to `history` and emits payload on port `message`.
3. LLM node auto-runs immediately on new input executing a prompt referencing `latest.message`.
4. LLM emits response on port `output`.
5. ChatNode receives response and automatically appends an `assistant` entry in `history`.

## Assumptions
- LLM node already supports `prompt` templating with `latest` view.
- ChatNode execution layer will wrap outbound user message into emission under `message` port.
- Assistant reply classification performed by LLM executor (sets role when emitting back) or ChatNode infers `assistant` for inbound messages from LLM node.

## Acceptance Criteria
1. Loading the demo graph shows two nodes connected in a loop without errors.
2. Sending a user message produces a new history entry in ChatNode.
3. After triggering LLM run, a new assistant entry appears in ChatNode history.
4. History does not duplicate messages on reload.
5. No unhandled exceptions in console during send/response cycle.

## Future Enhancements
- Intercept function on ChatNode to recognize graph-building instructions.
- Token streaming and partial updates.
- Safety telemetry & improved loop diagnostics.

Status: Completed (Auto-run + assistant loop); Docs & some automated tests Deferred
Created: 2025-09-15

## Implemented MVP Actions & Run Flow (Update)

### New Endpoint
- `POST /api/nodes/:id/run` — invokes generic execution pipeline defined in `apps/web/lib/execution.ts`.
	- Response: `{ runId, emissions?: Array<{ port: string; value: any }>, patchProps?, diagnostics?, error? }`.

### Execution Internals (MVP)
- In-memory input buffers: nodeId → port → EdgePayload[] (no persistence yet).
- `runNode(id)` builds `latest` view (most recent payload per port) and calls registered executor.
- Emissions collected via `ctx.emit(port,value)` plus any `outputs` returned.
- Recursion safeguard: run chain length > 5 or same node repeated > 2 aborts (`error: run_chain_depth_exceeded`).

### Registered Executors
- `LLM` (stub): Renders `promptTemplate` replacing `{message}` with `latest.message`. Emits `output: "Assistant: <rendered>"`.
- Other node types: No-op warning diagnostic (no executor yet).

### ChatNode Send Action Integration
- On `Send`: append history entry (role `user`), persist via PUT `/api/nodes/:id`.
- After successful persistence: `emitFrom(nodeId,'message', userContent)` pushes payload into buffers of downstream nodes.

### Assistant Response Append
- When `emitFrom` propagates an emission where source.type=`LLM` and target.type=`ChatNode`, target history is patched with new entry `{ role:'assistant', content, ts }`.

### Ports (Implicit for MVP)
- ChatNode logical outbound port: `message`.
- LLM outbound port: `output` (executor emits there).

### Minimal Run Sequence (Manual)
1. User sends message (ChatNode → emit `message`).
2. User triggers LLM run (UI will call POST run endpoint for LLM node).
3. LLM emits assistant reply → ChatNode history auto-augmented.

### Known Limitations
- Input buffers not persisted; reload loses transient messages not in ChatNode history.
- No streaming tokens yet.
- Recursion guard coarse (depth + repetition only).

### Follow-Up Tasks (Outside MVP Scope)
- Persist input buffers or derive them from emission log.
- Auto-run policy (`x-execPolicy.autoRunOnInput`).
- Distinguish assistant vs tool responses via richer payload object.
- Streaming token support.


## Implementation Checklist

Legend: [ ] = not started, [~] in progress, [x] complete

### Prerequisites
- [x] PBI-29 ChatNode implemented (schema + UI + send action).
- [x] LLM node supports prompt templating referencing `latest.message`.
- [x] Emission path from ChatNode "send" to output port `message`.

### Slice 1: Demo Graph Asset
- [x] Created `nodes/ChatLLMDemo.json` with ChatNode-Seed & LLM-Demo.
- [x] Added edges forming message/output loop.
- [x] Validated loads without schema errors.

### Slice 2: ChatNode Outbound Emission
- [x] Send action emits user content on `message` port.
- [x] Empty input guard (disabled button) prevents emission.

### Slice 3: LLM Execution Flow
- [x] Executor reads `latest.message` for prompt.
- [x] Templating already functional.
- [x] Auto-run triggers on new inbound message (manual still works).

### Slice 4: Assistant Response Append
- [x] Assistant reply appended when source type = LLM.
- [x] Role inference (payload simple string); will preserve if structured payload later.

### Slice 5: Loop Safety
- [x] Depth + repetition guard implemented (halts >5 chain length or >2 repeats).
- [x] Documented in Execution Internals.

### Slice 6: Verification & QA
- [x] Smoke/integration test covers send→auto-run→assistant reply.
- [x] Manual graph load shows nodes & edges without errors.
- [x] History stable across reload (manual verification).
- [ ] Automated console error capture (Deferred).

### Slice 7: Documentation & Example
- [ ] README section (Deferred; will describe auto-run now present).
- [ ] Sample transcript snippet (Deferred).
- [ ] Limitations section update (Deferred) — streaming & persistence still pending.

### Acceptance Criteria Mapping
- [x] AC1 graph loads (manual + smoke path).
- [x] AC2 send adds user history entry.
- [x] AC3 assistant entry appended (auto-run path).
- [x] AC4 no duplicate on reload (manual verification).
- [ ] AC5 no console errors (Deferred automated capture; manual review clean).

### Deferred / Future (See Future Enhancements)
- [ ] Intercept-based instruction parsing.
- [ ] Token streaming & partial update UI.
- [ ] Enhanced loop telemetry / metrics.
- [ ] README + transcript docs.
- [ ] Automated console error capture.
