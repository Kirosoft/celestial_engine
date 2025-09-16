# PBI-33 File Reader Node

## Goal
Introduce a `FileReaderNode` that can read either a single file or iterate over multiple files in a directory, filtering by glob / extension patterns (e.g. `*.jpg,*.png`). It should sequentially emit each matched file (or its metadata/content) one-at-a-time into the graph so downstream nodes (e.g. LLM, image processors, logging, etc.) can consume and react to each item.

## Motivation
Many workflows require batch ingestion: processing a folder of assets, summarizing documents, or feeding images through a classification or captioning chain. A dedicated file reader node provides:
- Declarative configuration (path + filter + mode)
- Deterministic iteration ordering & restartability
- Controlled emission pacing (avoid flooding the graph)
- Extensible output shape (raw bytes vs. metadata vs. text decode)

## Functional Requirements
1. Support two primary modes:
   - `single` – read exactly one file at `filePath`.
   - `directory` – enumerate files under `dirPath` (non-recursive MVP; recursion optional future) filtered by `includePatterns`.
2. Filtering:
   - Accept comma or newline separated glob patterns (e.g. `*.jpg,*.png`).
   - If empty, default to `*` (all files).
   - Case-insensitive match for extensions (MVP); later allow case-sensitive toggle.
3. Emission:
   - In `single` mode, emit exactly once upon explicit `read` action (or auto-run if `autoStart` enabled).
   - In `directory` mode, maintain internal iteration state (`cursorIndex`). Each `next` action emits the next file until exhausted.
   - Optional `autoEmitAll` (deferred) could loop automatically; MVP is manual `next` button.
4. Output Port(s):
   - Primary port: `file` (object containing metadata + content reference / preview).
   - Secondary (optional future): `content` (raw text if decoding text file).
5. Actions:
   - `read` (single mode): reads file & emits.
   - `scan` (directory mode): enumerates & prepares queue (does NOT emit).
   - `next` (directory mode): emits next file from queue.
   - `reset` (directory mode): clears queue & cursor; can re-run `scan`.
6. Persisted Props:
   - Input configuration (paths, patterns, decoding options).
   - File list snapshot (array of relative names) after `scan`.
   - Cursor index (0-based, -1 when not started).
7. Validation:
   - Exactly one of `filePath` or `dirPath` required depending on `mode`.
   - At least one pattern token if `includePatterns` non-empty.
8. Error Handling:
   - Missing path => validation error.
   - Non-existent file/dir => runtime emission error (recorded in lastError prop; does not throw uncaught).
   - If `next` called with empty list or end-of-list, emit no file and return a status message (future) or simply no-op.
9. Concurrency Guard:
   - Prevent overlapping `next` actions (race) by locking until an emission completes.
10. Security / Path Safety:
   - Restrict to within `REPO_ROOT` (normalize & ensure prefix) to avoid directory traversal.

## Non-Functional Requirements
- Idempotent `scan` (same directory & patterns yields deterministic ordering: lexical sort ascending).
- Large directory resilience: only store filenames + minimal metadata in props; stream content on demand.
- Emission should add minimal overhead; reading file content on `next` only for that item.

## Data Model (Props Draft)
```ts
interface FileReaderProps {
  mode: 'single' | 'directory';
  filePath?: string;      // required if mode=single (repo-root relative or absolute constrained to REPO_ROOT)
  dirPath?: string;       // required if mode=directory
  includePatterns?: string; // comma or newline separated globs, default '*'
  emitContent?: boolean;  // if true and text-like, include text in payload.preview
  maxFileSizeBytes?: number; // safety cap for reading full content (default 512_000)
  encodedAs?: 'text' | 'base64' | 'none'; // representation for binary outputs (MVP: 'text' for utf-8 else 'base64')
  scannedFiles?: string[]; // snapshot of matching relative filenames after scan
  cursorIndex?: number;     // -1 = not started, else index into scannedFiles
  lastError?: string | null; // last runtime error message
}
```

## Output Payload (Proposed)
```ts
interface FileEmission {
  path: string;          // relative path from dir root or filePath relative to REPO_ROOT
  absolutePath: string;  // (internal only, not emitted unless debug flag)
  size: number;          // bytes
  modifiedMs: number;    // mtime epoch
  contentEncoding?: 'utf-8' | 'base64';
  content?: string;      // present only if emitContent
  index?: number;        // sequence number (for directory mode)
  total?: number;        // total files in batch (directory mode)
}
```

## Schema (Draft JSON Snippet)
```jsonc
{
  "$id": "FileReaderNode.schema.json",
  "title": "FileReaderNode",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "type": { "const": "FileReaderNode" },
    "name": { "type": "string" },
    "props": {
      "type": "object",
      "properties": {
        "mode": { "type": "string", "enum": ["single","directory"], "default": "single" },
        "filePath": { "type": "string" },
        "dirPath": { "type": "string" },
        "includePatterns": { "type": "string", "default": "*" },
        "emitContent": { "type": "boolean", "default": false },
        "maxFileSizeBytes": { "type": "integer", "minimum": 1, "maximum": 104857600, "default": 512000 },
        "encodedAs": { "type": "string", "enum": ["text","base64","none"], "default": "text" },
        "scannedFiles": { "type": "array", "items": { "type": "string" }, "default": [] },
        "cursorIndex": { "type": "integer", "minimum": -1, "default": -1 },
        "lastError": { "type": ["string","null"], "default": null }
      },
      "required": ["mode"],
      "additionalProperties": false,
      "allOf": [
        { "if": { "properties": { "mode": { "const": "single" } } }, "then": { "required": ["filePath"] } },
        { "if": { "properties": { "mode": { "const": "directory" } } }, "then": { "required": ["dirPath"] } }
      ]
    }
  },
  "required": ["id","type","name","props"],
  "additionalProperties": false,
  "x-actions": [
    { "name": "read", "description": "Reads and emits the single file (single mode)." },
    { "name": "scan", "description": "Enumerates directory + filters and stores list (directory mode)." },
    { "name": "next", "description": "Emits the next file from scannedFiles (directory mode)." },
    { "name": "reset", "description": "Clears scannedFiles and cursorIndex." }
  ]
}
```

## Sequencing Strategy (Directory Mode)
1. User configures `dirPath` and (optionally) `includePatterns`.
2. User triggers `scan`:
   - Validate directory exists & inside `REPO_ROOT`.
   - Glob match patterns; collect file names (non-recursive MVP) sorted lexicographically.
   - Persist `scannedFiles` and set `cursorIndex = -1`.
3. For each emission cycle, user triggers `next`:
   - If `cursorIndex + 1 >= scannedFiles.length` => no-op (optionally set `lastError = "end_of_list"`).
   - Else increment cursor, read file metadata (+ content if `emitContent`).
   - Build `FileEmission` object; emit via port `file`.
   - (Optional future) After emission, if `autoAdvance` or `autoEmitAll` set, schedule next tick.
4. `reset` sets `scannedFiles = []`, `cursorIndex = -1`, clears `lastError`.

State Machine (simplified):
```
Idle -> (scan) -> Scanned(list, cursor=-1)
Scanned -> (next) -> Emitting(i) -> Scanned(cursor=i)
Scanned(cursor=last) --(next)--> Exhausted (cursor=last, no emission)
Exhausted --(scan)--> Scanned(new list)
Scanned/Exhausted --(reset)--> Idle
```

## Actions & Emission Mapping
| Action | Mode | Effect |
|--------|------|--------|
| read | single | Reads `filePath` and emits one payload |
| scan | directory | Populates `scannedFiles`, leaves cursor at -1 |
| next | directory | Emits next file, increments cursor |
| reset | directory | Clears list & cursor |

## Acceptance Criteria
1. Creating a `FileReaderNode` with default props yields `mode="single"` and no errors.
2. In single mode with valid `filePath`, invoking `read` emits one payload containing at least `path`, `size`, `modifiedMs`.
3. In directory mode, `scan` populates `scannedFiles` (lexically sorted) respecting `includePatterns`.
4. Consecutive `next` calls emit files in order and include `index` and `total` fields.
5. After last file, further `next` produces no emission (and does not throw).
6. Switching `dirPath` then rescanning updates `scannedFiles` and resets cursor.
7. If `emitContent=true` and file size <= `maxFileSizeBytes`, payload includes `content` + `contentEncoding` consistent with `encodedAs`.
8. Oversized file (> `maxFileSizeBytes`) results in omission of `content` but still emits metadata.
9. Invalid path (outside REPO_ROOT) sets `lastError` with a descriptive message and emits nothing.
10. Validation enforces `filePath` presence in single mode and `dirPath` in directory mode.
11. `reset` clears `scannedFiles` and `cursorIndex` and removes `lastError`.
12. Guard test validates schema (AJV) and minimal action metadata exists.

## Deferred / Future Enhancements
- Recursive directory traversal (`recursive: boolean`).
- Exclude patterns list.
- Throttled auto-emission (`autoEmitAll` with delay).
- File type detection (MIME sniff) & conditional decoding.
- Binary streaming chunk port.
- Caching / hash of file contents for change detection.
- Watch mode (emit on new file arrivals).
- Pagination window (emit batch not single).
- Directory recursion depth limit.

## Risks / Open Questions
- Very large directories could create large `scannedFiles` arrays (mitigation: future cap + paged scanning).
- Binary vs text detection heuristics — MVP pushes complexity to user via `emitContent` + `encodedAs`.
- Emission ordering if files mutate during iteration (accept eventual consistency; no locking strategy MVP).

## Implementation Slices
1. Schema + seed registration.
2. Repository utilities: safe path resolution & directory enumeration with glob filtering.
3. Action handlers / executor integration (map `read|scan|next|reset` to repo ops + emission calls).
4. State persistence wiring (update node props on scan/reset/advance).
5. Emission payload builder + size/content gating.
6. Basic unit tests: scanning, next iteration, size cap content omission, validation cases.
7. Smoke test: create node, seed test folder, scan, iterate all files, collect emissions.
8. Optional UI node component with: path inputs, pattern input, buttons: Scan, Next, Reset, and progress display.

## Test Plan (High Level)
- Unit: pattern parsing (split & trim), directory listing filter, size gating.
- Unit: state transitions (`cursorIndex` correctness across next/reset/scan).
- Integration: API invocation or direct repo calls to simulate user actions and verify persisted props.
- Smoke: Controlled temp directory with sample files (`a.txt`, `b.jpg`, `c.png`) verifying order and filtering.

## Status
Proposed (Not Started)

Owner: (assign)
Created: 2025-09-16

---
Pending approval; upon acceptance proceed with Slice 1 (schema + seed).
