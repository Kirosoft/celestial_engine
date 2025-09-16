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
