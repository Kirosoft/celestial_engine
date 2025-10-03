# Changelog

All notable changes to Celestial Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2025-10-02

### Phase 1 Complete - MVP Release ✅

**Summary:** First stable release with core graph execution, schema validation, and basic UI.

### Added

#### Core Infrastructure
- File-based node/edge persistence with atomic writes (temp-file + rename pattern)
- JSON Schema validation with AJV (runtime property validation)
- Schema loader with lazy compilation and caching
- Node repository with CRUD operations (create, read, update, delete, rename)
- Edge repository with integrity checks (cycle detection, dangling edge cleanup)
- Index repository for fast node lookups and hash tracking
- Integrity guard to repair graph inconsistencies on boot
- Path safety validation to prevent directory traversal attacks

#### Execution Engine
- Emission queue with middleware pipeline
- Input buffering with three strategies: `latest`, `window`, `since`
- Capability registry defining node behaviors (autoExecuteOnInput, logsInputs, receivesHistory)
- History middleware (appends execution context to downstream nodes)
- Log middleware (structured log entry creation with classification)
- Variable mapping helper for LLM prompt rendering
- Cold pull support (fetch FileReaderNode/ChatNode/LogNode content on-demand)
- Diagnostic emission system (cold_pull_*, implicit_var_mapping_added, etc.)
- LLM provider abstraction (OpenAI, Ollama, Anthropic detection)
- Mustache-style variable injection in prompts

#### Node Types
- **Task** - Planning/checklist text container
- **Code** - Code snippets with language tagging
- **LLM** - AI completion with multi-provider support, prompt templates, variable injection
- **ChatNode** - User input with manual message emission
- **LogNode** - Execution log viewer with history filtering, maxEntries, resize, clear
- **FileReaderNode** - File I/O (single file or directory scan, emit on action)
- **Group** - Subgraph container with proxy nodes and isolated edge routing

#### UI Components
- Canvas with ReactFlow integration (drag, zoom, pan)
- Node drag & position persistence
- Edge creation via drag & click connections
- Inspector panel with schema-driven property forms
- Toolbox with draggable node type palette
- Custom node renderers (BasicNode, ChatNode, LogNode, FileReaderNode)
- Group expansion/navigation (enter subgraph view)
- Delete guards (prevent accidental LogNode deletion)
- System settings panel (API keys, Ollama config)
- File explorer for FileReaderNode path selection
- Resizable Inspector with double-click reset
- Collapsible Toolbox with position persistence

#### API Endpoints
- `/api/nodes` - List, create, update, delete nodes
- `/api/nodes/[id]` - Get single node
- `/api/nodes/[id]/run` - Execute node & cascade downstream
- `/api/nodes/[id]/emit` - Manual emission (ChatNode)
- `/api/nodes/[id]/position` - Save canvas coordinates
- `/api/edges` - Create edges
- `/api/edges/[sourceId]/[edgeId]` - Update/delete edge
- `/api/groups/[groupId]/subgraph` - Group interior view
- `/api/groups/[groupId]/edges` - Group-scoped edge operations
- `/api/schemas/[type]` - Schema retrieval
- `/api/node-types` - Available node type list
- `/api/system/settings` - Global config (API keys, Ollama URL)
- `/api/fs` - File browser for FileReaderNode

#### Testing
- Vitest unit tests: bufferStore, capabilityRegistry, queue, varMapping, scenarios, logHistory
- Playwright E2E tests: edge-drag-ui, edges-integrity, group-subgraph-edges, inspector-delete-guard
- Integration tests: Chat→LLM→Log pipeline, FileReaderNode actions, LogNode integration
- Test coverage for critical execution paths
- E2E environment isolation (separate REPO_ROOT per test)

#### Documentation
- PBI backlog with 31 items covering architecture, features, tests
- Execution architecture documentation (execution-v2.md)
- Functional specification (functional specification.md)
- Testing guide (TESTING.md)
- README with setup instructions and troubleshooting
- Phase 1 completion summary (PHASE-1-COMPLETE.md)
- Phase 2 planning document (PHASE-2-PLANNING.md)

### Fixed
- LogNode resize no longer shows stale history (guarded history synchronization)
- Temp file parse errors suppressed (added .tmp-* filtering to listNodes)
- Duplicate node IDs handled gracefully (dedupe in useGraphData)
- Edge duplication prevented (dedupe by edge ID)
- Delete key blocked in input fields (prevents accidental node deletion while editing)
- Group root position updates now skip group-scoped endpoint (prevents 404)
- JSON parse errors enriched with file path context
- Missing REPO_ROOT in E2E tests now throws immediately (prevents silent failures)

### Changed
- Removed graph refresh dispatch from LogNode resize (prevents stale history reload)
- Enhanced FileRepo.readJson error messages with file path and content length
- listNodes now skips malformed JSON files with warning instead of throwing
- Position update endpoint returns early for group root (avoids duplicate writes)
- Inspector delete button now requires explicit click (no accidental touch triggers)

### Security
- Path traversal protection in fileRepo.safeJoin
- Schema whitelist for FileReaderNode props (prevents arbitrary property injection)
- API key storage in system settings (not exposed in client bundle)

---

## [Unreleased]

_Features planned for Phase 2 - see [PHASE-2-PLANNING.md](./PHASE-2-PLANNING.md)_

---

[0.1.0]: https://github.com/Kirosoft/celestial_engine/releases/tag/v0.1.0
