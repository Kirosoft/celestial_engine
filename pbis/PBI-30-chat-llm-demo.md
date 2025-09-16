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
3. LLM node receives payload (as latest input) and on manual or auto run executes with prompt referencing `latest.message`.
4. LLM emits response on port `output`.
5. ChatNode receives response; interceptor (future) or normal handling appends it as `assistant` entry in `history`.

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
- Auto-run LLM immediately when a new chat message arrives.
- Intercept function on ChatNode to recognize graph-building instructions.
- Token streaming and partial updates.
- Safety: Guard against infinite rapid loops (limit recursion count per run chain).

Status: Draft
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
- No auto-run of LLM on new message (deferred enhancement).
- No cycle edges allowed yet; demo requires manual run and two separate edges only if cycle policy adjusted.

### Follow-Up Tasks (Outside MVP Scope)
- Persist input buffers or derive them from emission log.
- Auto-run policy (`x-execPolicy.autoRunOnInput`).
- Distinguish assistant vs tool responses via richer payload object.
- Streaming token support.


## Implementation Checklist

Legend: [ ] = not started, [~] in progress, [x] complete

### Prerequisites
- [ ] PBI-29 ChatNode implemented (schema + UI + send action).
- [ ] LLM node supports prompt templating referencing `latest.message` (verify existing executor).
- [ ] Emission path from ChatNode "send" to output port `message` (or add if missing).

### Slice 1: Demo Graph Asset
- [ ] Create `nodes/ChatLLMDemo.json` containing two nodes: ChatNode-Seed, LLM-Demo with basic props.
- [ ] Create edges: ChatNode-Seed:message -> LLM-Demo:input (port names per LLM schema) and LLM-Demo:output -> ChatNode-Seed:message (or chosen inbound port).
- [ ] Validate file passes schema loading on app startup.

### Slice 2: ChatNode Outbound Emission
- [ ] Ensure send action optionally emits `{ role:'user', content, ts }` payload on `message` port.
- [ ] Add guard to avoid emitting empty messages.

### Slice 3: LLM Execution Flow
- [ ] Confirm LLM executor reads `latest.message` from inputs to build prompt.
- [ ] If not present, adjust prompt templating or add small wrapper around inputs object.
- [ ] Manual run button triggers execution producing response on `output` port.

### Slice 4: Assistant Response Append
- [ ] On ChatNode inbound payload from LLM node (identify via source node type `LLM`), append role `assistant` entry.
- [ ] Fallback: if inbound payload already has role `assistant`, preserve.

### Slice 5: Loop Safety
- [ ] Add simple recursion guard (e.g., track run chain depth or ignore auto re-emission of assistant messages) to prevent tight infinite loops if auto-run is later enabled.
- [ ] Document guard in PBI file (optional if not implemented yet).

### Slice 6: Verification & QA
- [ ] Integration test: load demo graph, assert nodes + edges present.
- [ ] Simulate send: append user entry; ensure emission triggers LLM input buffer update.
- [ ] Trigger LLM run: assistant entry appears in ChatNode history.
- [ ] Reload app: history unchanged (no duplication).
- [ ] Capture console logs to assert no errors.

### Slice 7: Documentation & Example
- [ ] Add README section "Chat + LLM Demo" with quick start (open graph, send message, run LLM).
- [ ] Provide sample transcript snippet (user -> assistant) for reference.
- [ ] Mention limitations (manual LLM run for now, no streaming, potential future auto-run).

### Acceptance Criteria Mapping
- [ ] AC1 graph loads -> integration test.
- [ ] AC2 send adds user history entry -> reused ChatNode tests + demo test.
- [ ] AC3 LLM run adds assistant entry -> integration test.
- [ ] AC4 no duplicate on reload -> integration test (persist then reload).
- [ ] AC5 no console errors -> test harness captures.

### Deferred / Future (See Future Enhancements)
- [ ] Auto-run LLM on new chat message.
- [ ] Intercept-based instruction parsing.
- [ ] Token streaming.
- [ ] Advanced loop protection (rate limiting, chain depth metrics).
