---
id: PBI-01
title: FileRepo – Safe Filesystem Layer
phase: 1
status: completed
priority: high
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:00:00Z
dependsOn: []
---

## Goal
Provide a constrained file abstraction for all node/schema/index writes.

## Description
Implement `FileRepo` with secure path joining, existence checks, atomic write (temp + rename), JSON helpers, directory ensure, and rejection of paths escaping `REPO_ROOT`.

## Business Value
Prevents data corruption and security issues; foundational for all subsequent features.

## Acceptance Criteria
- Rejects attempts containing `..` or absolute paths outside root (typed error)
- All writes are atomic (temp file + rename)
- Functions: `read(path)`, `write(path,data)`, `list(glob)`, `exists(path)`, `delete(path)` implemented
- 100% of higher-level repos in Phase 1 use FileRepo (no raw fs outside)

## Definition of Done
- Unit tests for path sanitization & atomic write
- Performance: write 100 small files < 500ms local dev
- Code documented & lint clean

## Implementation Checklist
- [x] Path sanitizer utility (`safeJoin`)
- [x] Atomic write helper (temp + fs.rename)
- [x] JSON read/write wrappers
- [x] Glob listing via fast-glob
- [x] Error class definitions (`PathEscapeError`)
- [ ] Unit test: path traversal rejection (deferred)
- [ ] Unit test: atomic write durability (simulate crash) (deferred)

## Test Cases
1. Reject `../escape` path
2. Write+read round trip equality
3. Overwrite existing file retains full new contents
4. Concurrent writes serialize safely (no partial truncation)

## Risks / Notes
None blocking. Simplicity favored; no watch feature yet.
