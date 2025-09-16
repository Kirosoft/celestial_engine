# PBI-31 Logging (Output) Node

## Goal
Introduce a lightweight `LogNode` that passively receives inbound emissions (strings or JSON-serializable values) and appends them to an internal scrollable log history for inspection. The node has no outbound edges (output-only sink) and serves as an on-graph debug/observability surface.

## Motivation
During graph development and troubleshooting it's valuable to observe the raw payloads flowing through edges without attaching external tooling or opening network inspectors. A dedicated logging node:
- Provides an always-visible, persistent record of recent messages
- Reduces friction when validating new executors or edge wiring
- Establishes a standardized sink semantics for future metrics/analytics nodes

## Functional Requirements
1. Accept inbound edges; for each emission payload received, append a log entry.
2. Display log entries newest last in a vertically scrollable area (fixed-height inside the node component).
3. Each entry stores: `id`, `ts` (epoch ms), `sourceId` (node id of sender if available), `port` (source port), `kind` (string describing payload classification), `preview` (string), and optional `raw` (full value) if small.
4. Provide an optional `maxEntries` cap (default 300); trimming oldest entries when exceeded.
5. Provide a `clear` action (schema `x-actions`) that immediately empties the log history (client-side only, persisted, no confirmation).
6. Support string payloads and structured objects. If object, attempt to pretty-print or derive a one-line preview (first 120 chars JSON).
7. Persist history in node file (`props.history`).
8. No outbound emission (enforce: attempts to connect from LogNode as source are rejected or visually disabled later).
9. Support optional `filterIncludes` (string array) to only record entries whose preview (case-insensitive) includes any filter token. Empty or absent -> record all.
10. Auto-scroll to bottom when a new entry arrives (unless user has manually scrolled up—future enhancement, MVP always scrolls).

## Non-Functional Requirements
- Appending an entry is O(1) (slice only when trimming).
- Rendering should virtualize only if performance degrades (>500 entries) — not required MVP.
- No blocking expensive JSON serialization for very large objects (>10KB) — store `[Large object omitted]` preview.

## Data Model
```ts
props: {
  history: Array<{
    id: string;         // nanoid
    ts: number;         // epoch ms
    sourceId?: string;  // upstream node id if known
    port?: string;      // upstream source port
    kind?: string;      // classifier: 'text' | 'json' | 'other'
    preview: string;    // truncated safe display form
    raw?: any;          // optional original value if small (<2KB when JSON.stringify)
  }>;
  maxEntries?: number;      // default 300
  filterIncludes?: string[];// optional whitelist tokens
}
```

## Schema (Draft JSON Snippet)
```jsonc
{
  "$id": "LogNode.schema.json",
  "title": "LogNode",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "type": { "const": "LogNode" },
    "name": { "type": "string" },
    "props": {
      "type": "object",
      "properties": {
        "history": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id","ts","preview"],
            "properties": {
              "id": { "type": "string" },
              "ts": { "type": "number" },
              "sourceId": { "type": "string" },
              "port": { "type": "string" },
              "kind": { "type": "string" },
              "preview": { "type": "string" },
              "raw": {}
            },
            "additionalProperties": false
          },
          "default": []
        },
        "maxEntries": { "type": "number", "minimum": 1, "default": 300 },
        "filterIncludes": { "type": "array", "items": { "type": "string" }, "default": [] }
      },
      "required": ["history"],
      "additionalProperties": false
    }
  },
  "required": ["id","type","name","props"],
  "additionalProperties": false,
  "x-actions": [
  { "name": "clear", "description": "Clears all log entries immediately (cannot be undone)" }
  ]
}
```

## UI / UX
- Header: Node name (default "Log") + optional count badge (e.g., 128 entries).
- Scroll Area (~160px height): monospace or small font list, each line: time (HH:MM:SS) • sourceId (shortened) • port • preview.
- Hovering an entry (future): show tooltip with full preview / raw JSON.
- Clear Button: small destructive-styled button in footer or header action chip.
- Auto-scroll: always scrolls to bottom when new entry added (MVP; no pin state yet).

## Edge Semantics
- Inbound only: treat any incoming emission payload.
- Outbound edges disallowed (validation layer prevents creation with LogNode as source or executor never emits).

## Acceptance Criteria
1. Creating a LogNode results in empty `history` array persisted.
2. Inbound emission with string payload produces a history entry with `kind='text'`, preview equals raw (trimmed if >120 chars with ellipsis), timestamp set.
3. Inbound emission with object payload stores `kind='json'` and a JSON-stringified preview (<=120 chars) and, if serialized length < 2000, copies object to `raw`.
4. When `history.length` exceeds `maxEntries`, oldest entries are removed so final length == `maxEntries`.
5. `filterIncludes` (non-empty) causes entries whose lower-cased preview matches none of the tokens to be skipped.
6. Clicking `clear` empties history immediately and persists node; subsequent emissions repopulate from empty.
7. Reloading app preserves existing history entries.
8. No outbound edges can be created from a LogNode (attempt returns 400/409 or is blocked client-side).
9. No console errors during rapid (>=20) sequential inbound messages test.

## Out of Scope (MVP)
- Pause / resume capture
- Severity tagging or color-coding by level
- Regex-based filtering (simple substring only for now)
- Export / download log
- Virtualized list rendering

## Risks / Open Questions
- Large raw objects could bloat node JSON size (mitigated by size threshold & omission).
- Rapid bursts may cause frequent PUT operations (acceptable for early dev; future batching possible).
- Need a consistent mechanism to inject `sourceId` and `port` (depends on emission pipeline context availability).

## Implementation Notes
- Extend execution/emission pathway (`emitFrom`) to detect LogNode targets and call `appendLogEntry` utility.
- Utility: `appendLogEntry(history, payload, meta, maxEntries, filters)` returns trimmed new array.
- Ensure schema added to loader & seeding.
- UI component similar pattern to `ChatNode` but read-only; no composer.
- Dedicate `logNode` type in `nodeTypes` map with separate TSX component.
- Enforce no outbound edges: client-side block in edge creation handler + server validation in edge POST.

## Test Plan
- Unit: `appendLogEntry` (string, object, large object, filter skip, trimming behavior).
- Unit: schema validation with representative entries.
- Integration: create LogNode, simulate inbound emissions (call emit or run pipeline), verify persisted history length and entry content.
- Integration: clearing history persists empty array.
- Integration: attempt to create outbound edge from LogNode -> expect failure.
- (Optional) Performance micro-test: append 400 messages and ensure trimming keeps 300.

---
Status: Partially Completed (Schema + Backend Logging + Emission Integration); UI Component, Clear Action UI & Docs Deferred
Created: 2025-09-16

## Implementation Checklist

Legend: [ ] not started, [~] in progress, [x] complete

### Slice 1: Schema & Registration
- [x] Add `schemas/nodes/LogNode.schema.json` file per draft schema.
- [x] Register schema with loader and include in seed/migration.

### Slice 2: Data Utilities
- [x] Implement `appendLogEntry(history, payload, meta, maxEntries, filters)` (in `logHistory` utility).
- [x] Classify `kind` (text|json|other) & produce preview (truncate).
- [x] Size guard: omit `raw` if serialized length >= threshold.
- [x] Unit tests for classification, truncation, trimming, filtering.

### Slice 3: Emission Integration
- [x] Emission pipeline detects LogNode targets & appends entries.
- [x] Updated history persisted via node update API.
- [x] `filterIncludes` respected (case-insensitive substring compare).

### Slice 4: Outbound Edge Guard
- [ ] Client: prevent drag/create where source.type === 'LogNode' (Deferred).
- [x] Server: reject POST /api/edges if source node is LogNode (implemented rule).
- [ ] Test attempts result in 4xx and no edge persisted (Deferred automated test).

### Slice 5: UI Component
- [ ] Create `LogNode.tsx` component (Deferred – backend-only logging available).
- [ ] Render entries list.
- [ ] Clear button wiring.
- [ ] Add to `nodeTypes` map (Deferred until component implemented).

### Slice 6: Action Handling (Clear)
- [x] Schema `x-actions` exposes `clear`.
- [ ] Implement UI handler to persist empty history (Deferred).
- [ ] Unit / integration test for clear (Deferred).

### Slice 7: Edge / Performance Validation
- [x] Trimming logic validated in unit tests.
- [ ] Stress test 350 emissions scenario (Deferred explicit test).
- [ ] React key warnings check (Deferred until UI exists).

### Slice 8: Documentation
- [ ] README node types table update (Deferred).
- [ ] Troubleshooting note re filtering (Deferred).

### Acceptance Criteria Mapping
- [x] AC1 empty history on create (verified via schema & initial node props).
- [x] AC2 string emission creates classified text entry.
- [x] AC3 object emission classified json with preview + optional raw.
- [x] AC4 trimming logic covered in unit tests.
- [x] AC5 filter logic unit tested.
- [ ] AC6 clear action UI & persistence (Deferred).
- [x] AC7 persistence (history retained across reload) manual verification.
- [x] AC8 outbound edge creation blocked server-side (client test Deferred).
- [ ] AC9 rapid emission console error capture (Deferred – manual spot check only).

### Deferred / Future Enhancements
- [ ] UI component & visual rendering.
- [ ] Clear action implementation & tests.
- [ ] Client-side outbound edge prevention.
- [ ] Pause/resume capture toggle.
- [ ] Severity tagging & color-coded badges (info/warn/error).
- [ ] Export / download log entries as JSON/NDJSON.
- [ ] Search box / advanced filter UI.
- [ ] Virtualization for > 1k entries.
- [ ] Stress + rapid emission automated test.
- [ ] Console error automated capture.

### Additional Deferred Items Summary
Pending work centers on UI/UX (node component, clear button), client enforcement, documentation, and advanced operational tooling (stress tests, perf virtualization, export & search). Backend logging pipeline is stable and integrated with emission system.

