# Phase 1 Product Backlog Items

| ID | Title | Priority | Estimate | Depends On |
|----|-------|----------|----------|------------|
| PBI-01 | FileRepo – Safe Filesystem Layer | high | 3 | - |
| PBI-02 | NodeRepo – Core Node CRUD & Rename | high | 5 | PBI-01 |
| PBI-03 | Edge Management & Validation | high | 5 | PBI-02 |
| PBI-04 | Node Type Schema Loader | high | 3 | PBI-01 |
| PBI-05 | AJV Validation Service | high | 3 | PBI-04 |
| PBI-06 | Seed Node Type Schemas | high | 5 | PBI-05 |
| PBI-07 | Graph Index Builder | medium | 3 | PBI-02, PBI-05 |
| PBI-08 | Position Update Support | medium | 2 | PBI-02 |
| PBI-09 | Node API Endpoints | high | 5 | PBI-02, PBI-05, PBI-07 |
| PBI-10 | Edge API Endpoints | high | 3 | PBI-03, PBI-02 |
| PBI-11 | Integrity Guard – Dangling Edge Detection | medium | 2 | PBI-02, PBI-03 |
| PBI-12 | Standard Error & Result Types | medium | 3 | PBI-05, PBI-09, PBI-10 |
| PBI-13 | Developer Documentation (Phase 1) | medium | 3 | All previous |
| PBI-14 | Playwright Integration Test Suite | medium | 5 | PBI-09, PBI-10, PBI-06, PBI-11 |

## Navigation
- [PBI-01](PBI-01-file-repo.md)
- [PBI-02](PBI-02-node-repo.md)
- [PBI-03](PBI-03-edges.md)
- [PBI-04](PBI-04-schema-loader.md)
- [PBI-05](PBI-05-validation-service.md)
- [PBI-06](PBI-06-seed-schemas.md)
- [PBI-07](PBI-07-graph-index.md)
- [PBI-08](PBI-08-position-updates.md)
- [PBI-09](PBI-09-node-api.md)
- [PBI-10](PBI-10-edge-api.md)
- [PBI-11](PBI-11-integrity-guard.md)
- [PBI-12](PBI-12-error-handling.md)
- [PBI-13](PBI-13-docs.md)
- [PBI-14](PBI-14-playwright-integration-tests.md)

## Status Legend
- planned
- in-progress
- blocked
- done

## Next Steps
1. Prioritize and assign owners.
2. Create implementation branches per cluster (FileRepo+NodeRepo first).
3. Add test harness early (PBI-01 & PBI-02).

---
Generated: 2025-09-12
