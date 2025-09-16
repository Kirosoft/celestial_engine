# PBI-29 Chat Node

## Goal
Introduce an interactive `ChatNode` that allows users to accumulate and review a scrollable conversation history and send new chat messages. The node should accept inbound connections whose payload values are appended to the history. Users can manually enter a message via an input line and press a `Send` action button (exposed as a schema command) to append it to the history and (future enhancement) emit it downstream. A `Clear` action/button provides an immediate way to purge the stored conversation (no confirmation) while keeping the node otherwise intact.

## Motivation
Workflows involving LLMs or collaborative agents need a structured conversational context. A dedicated chat node:
- Provides a visual + interactive place to inspect evolving conversation turns
- Normalizes how upstream textual data (e.g., ToolCall results or Task output) becomes part of a threaded history
- Establishes a pattern for action buttons on nodes ("send") injecting data into the graph

## Functional Requirements
1. Display a vertically scrollable history area (fixed height in node, internal scroll) showing prior messages newest last.
2. Provide a single-line text input beneath (or above) history for composing a new message.
3. Provide `Send` and `Clear` action buttons.
  - `Send`:
   - Appends a new history entry with role=`user`, content from the input, timestamp.
   - Clears the input field.
   - Triggers a node update persistence event (same mechanism as other prop changes) so the history is saved.
  - `Clear`:
    - Immediately replaces `history` with an empty array and persists the node.
    - Does NOT alter other props (`maxEntries`, `systemPrompt`).
4. Accept inbound edges carrying textual content. On receipt (e.g., node props update or explicit apply step), each inbound value is appended as a history entry with role=`input` unless a richer typed object is detected.
5. Maintain history in `props.history` as an array of structured entries.
6. Node schema must expose both `Send` and `Clear` actions so the Inspector (future) or a command console can invoke them.
7. History should persist across reloads (file repo storage) and be included in snapshots.
8. History length is capped (configurable) — default 200 entries; oldest trimmed when exceeding.
9. Support optional `systemPrompt` prop (string) that is not part of history but can be rendered in a subtle preface section (future enhancement, not required for MVP display logic).

## Non-Functional Requirements
- UI performance: Appending a message should be O(1) and not re-render excessive sibling nodes.
- Accessibility: Scroll area should be keyboard scrollable; input should have an accessible label.
- Deterministic persistence: `history` mutations must flow through existing node update API.

## Data Model
```
props: {
  history: Array<{
    id: string;          // nanoid
    role: 'user' | 'input' | 'assistant' | 'system';
    content: string;
    ts: number;          // epoch ms
  }>;
  maxEntries?: number;   // optional override of default cap
  systemPrompt?: string; // optional guidance text (not stored in history)
}
```

## Schema (Draft JSON Snippet)
```jsonc
{
  "$id": "ChatNode.schema.json",
  "title": "ChatNode",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "type": { "const": "ChatNode" },
    "name": { "type": "string" },
    "props": {
      "type": "object",
      "properties": {
        "history": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id","role","content","ts"],
            "properties": {
              "id": { "type": "string" },
              "role": { "type": "string", "enum": ["user","input","assistant","system"] },
              "content": { "type": "string" },
              "ts": { "type": "number" }
            }
          },
          "default": []
        },
        "maxEntries": { "type": "number", "minimum": 1, "default": 200 },
        "systemPrompt": { "type": "string" }
      },
      "required": ["history"],
      "additionalProperties": false
    }
  },
  "required": ["id","type","name","props"],
  "additionalProperties": false,
  "x-actions": [
    {
      "name": "send",
      "description": "Appends a new user message (from transient input) to history and persists the node"
    },
    {
      "name": "clear",
      "description": "Removes all history entries immediately"
    }
  ]
}
```

## UI / UX
- Node Body Layout:
  - Header: Node name
  - Scroll box: fixed height (~140px) with light inner border; each entry: small timestamp + role tag + truncated content (wrap allowed, soft line wrap).
  - Composer: single-line input (internal state, not stored until send) + `Send` button.
- If `systemPrompt` present, display an italic, faint block above the history (not part of scroll area) — (Optional/Post-MVP if time).
- Auto-scroll to bottom on new entry.
- When exceeding `maxEntries`, remove oldest before adding new.

## Actions / Commands
- `send`: Requires non-empty composer input. Adds history entry (role=`user`). Future phase could trigger downstream execution/dispatch.
- `clear`: Clears all history entries immediately. No effect if already empty.
- Potential future actions: `injectSystemPrompt`.

## Edge Semantics
- Inbound edge providing a value (string) triggers append with role=`input`.
- Future: Outbound edges could emit last user message or entire transcript on send; left out of MVP to keep scope controlled.

## Persistence & Integrity
- `history` stored in node JSON (`nodes/ChatNode-*.json`).
- Trimming logic executed client-side prior to calling update API.
- Validation ensures well-formed history entries.

## Acceptance Criteria
1. Creating a `ChatNode` produces a node with empty `history: []`.
2. Typing a message and clicking `Send` appends an entry with role `user`, non-empty content, timestamp set (ms), and clears the input.
3. Incoming edge value (simulated via repository API) appends entry with role `input`.
4. History auto-scrolls to show the newest entry after send or inbound append.
5. When more than `maxEntries` messages exist, oldest messages are removed so length <= `maxEntries`.
6. Clicking `Clear` results in an empty `history` array persisted; subsequent reload shows no prior messages.
7. Schema validation passes for a node containing a representative history entry set.
8. Both `send` and `clear` actions are listed in schema `x-actions` array.
9. Reloading the app shows preserved history (unless cleared, in which case remains empty).
10. No console errors when sending, receiving, or clearing messages.

## Out of Scope (This PBI)
- Assistant / LLM generation logic
- Streaming tokens
- Rich markdown rendering
- Multi-select message operations
- Export transcript

## Risks / Open Questions
- Do we need debounced persistence for rapid sequential sends? (Assume no for MVP)
- Should inbound edge messages distinguish origin node id? (Potential extension: add optional `sourceId` field.)
- Potential large memory use if `maxEntries` is increased drastically — acceptable MVP risk.

## Implementation Notes
- Reuse existing node update API (PUT /api/nodes/:id) for history persistence.
- Add simple React component for ChatNode with internal composer state.
- Dispatch a lightweight custom event (e.g., `graph:refresh-request`) after send to keep other panels in sync (consistent with existing pattern).
- Add migration/seed: include `ChatNode` schema in seed pass.
- Provide a minimal unit test validating schema + basic history append logic (can reuse validation service + synthetic node modifications).

## Test Plan (High Level)
- Unit: schema validation of sample ChatNode with 2–3 history entries.
- Unit: trimming logic function (inject > maxEntries, ensure slice). (Utility function separated for testability.)
- Integration: create ChatNode via API, update with appended history, verify persisted.
- E2E (future): user fills input, clicks Send, sees entry appear.

---
Status: Draft
Owner: (assign)
Created: 2025-09-15

## Implementation Checklist

Legend: [ ] = not started, [~] = in progress, [x] = complete

### Slice 1: Schema & Registration
- [ ] Add `schemas/nodes/ChatNode.schema.json` with `history`, `maxEntries`, `systemPrompt`, and `x-actions:[send]`.
- [ ] Register schema in loader / validation registry.
- [ ] Add to seed/migration so schema is available on fresh load.

### Slice 2: Data Utilities
- [ ] Implement `appendHistoryEntry(history, entry, maxEntries)` utility that: assigns nanoid if missing, trims to cap (remove oldest) and returns new array.
- [ ] Unit test for trimming behavior (adds > cap, ensures length == cap and oldest removed).
- [ ] Unit test for entry shape validation (invalid role rejected / sanitized).

### Slice 3: Backend / Persistence Wiring
- [ ] Confirm node update API (`PUT /api/nodes/:id`) already persists `props.history` transparently.
- [ ] Add backend guard (optional) validating incoming `history` entries against schema (defensive) before write.
- [ ] Ensure inbound edge handling pathway can invoke a hook to append to `history` with role `input`.

### Slice 4: Inbound Edge Append
- [ ] Implement listener / orchestrator change: when ChatNode receives payload (string), call history append with role `input`.
- [ ] Support richer object detection (placeholder: if object with `{ role, content }` keep role else default `input`).
- [ ] Emit node updated event after append (avoid duplicate refresh storms — debounce not required MVP).

### Slice 5: Frontend Component
- [ ] Create `ChatNode` React component (scroll area ~140px height, internal overflow scroll).
- [ ] Render each entry: timestamp (HH:MM or relative), role tag, content (soft wrap, preserve whitespace minimally, limit max height maybe with CSS line clamp optional).
- [ ] Auto-scroll to bottom when new entry added (ref effect comparing length).
- [ ] Accessible markup: aria-label for history region, label for input field.
- [ ] Internal composer state (uncontrolled or controlled input) cleared on send.

### Slice 6: Action Handling (Send & Clear)
- [ ] Wire `Send` button to dispatch custom action (schema-driven) or direct local handler that:
  - Validates non-empty input.
  - Appends user entry (role `user`).
  - Persists via node update API (patch props: new history array).
- [ ] Disable `Send` (or no-op) when input empty / whitespace.
- [ ] Keyboard: Enter submits (Shift+Enter reserved / optional future newline behavior).
- [ ] Add `Clear` button: confirm then persist `history: []`.
- [ ] Disable / visually de-emphasize `Clear` when history already empty.

### Slice 7: Emission (Future Hook Placeholder)
- [ ] (Optional for MVP) After send, emit payload on `message` output port if execution/emission pipeline available.
- [ ] If emission not yet implemented, document deferral so PBI-30 can integrate later.

### Slice 8: System Prompt (Optional Display)
- [ ] If `systemPrompt` present, show faint italic block above history (outside scroll) — optional; can defer.

### Slice 9: Testing
- [ ] Unit: schema validation (sample history set passes, malformed fails).
- [ ] Unit: history append + trim utility (already above).
- [ ] Integration: create ChatNode via API, append entries, reload, ensure persistence.
- [ ] Integration: simulate inbound edge append (mock dispatch) resulting in role `input` entry.
- [ ] E2E (Playwright/Vitest): user types message and clicks Send -> entry appears & input cleared & auto-scroll.

### Slice 10: Performance & Accessibility
- [ ] Confirm O(1) append (avoid re-sorting; maintain chronological order by push).
- [ ] Verify no unnecessary re-renders (React dev tools highlight updates limited to ChatNode component).
- [ ] Keyboard navigation: Tab into input, Enter to send, arrow keys scroll history when focused.

### Slice 11: Documentation & Cleanup
- [ ] Update top-level README (node types table) to list ChatNode and brief description.
- [ ] Add short developer doc snippet describing history structure & append rules.
- [ ] Mark acceptance criteria items off within this PBI file (optional progress annotation).
- [ ] Record any deferred tasks (emission, systemPrompt styling) under a "Deferred" subsection.

### Acceptance Criteria Mapping
- [ ] AC1 empty history on create -> integration test.
- [ ] AC2 send appends user entry + clears input -> unit/E2E.
- [ ] AC3 inbound edge appends input entry -> integration test.
- [ ] AC4 auto-scroll behavior -> E2E.
- [ ] AC5 trimming logic -> unit test.
- [ ] AC6 clear action empties history -> integration test.
- [ ] AC7 schema validation -> unit test.
- [ ] AC8 send & clear actions present -> schema review.
- [ ] AC9 persistence across reload (history maintained) -> integration.
- [ ] AC10 no console errors -> E2E capture.

### Deferred / Nice-to-Have (Not Blocking MVP)
- [ ] Outbound emission on send (ties into execution framework).
- [ ] Distinguish inbound sourceId in history entries.
- [ ] Enhanced clear history UX (multi-step confirmation / undo).
- [ ] Rich markdown / formatting.
- [ ] History export.
