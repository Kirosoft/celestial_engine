---
id: PBI-12
title: Standard Error & Result Types
phase: 1
status: in-progress
priority: medium
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-12T00:33:30Z
dependsOn: [PBI-05, PBI-09, PBI-10]
---

## Goal
Standardize repository and API error objects.

## Description
Define typed errors or result wrappers; map to consistent HTTP JSON `{ error:{ code,message }, errors?[] }`.

## Business Value
Predictable client behavior and simpler telemetry.

## Acceptance Criteria
- All 4xx/5xx have error object
- Validation errors include path+message array

## Definition of Done
- Tests assert response shape across representative endpoints

## Implementation Checklist
- [x] Error classes (ValidationError, NotFoundError, ConflictError, CycleError)
- [x] HTTP mapping layer (apiErrors.ts)
- [x] Consistent error serializer (sendError)
- [ ] Standard success envelope adoption across routes (deferred)
- [ ] Ensure all routes uniformly include error codes (audit pass pending)

## Test Cases
1. Validation error includes errors[] array
2. NotFound returns 404 with code
3. Conflict returns 409 with code
4. Unexpected error returns 500 with sanitized message

## Risks / Notes
Future enrichment with correlation IDs. Current error handling exercised in integration & e2e tests (see `TESTING.md`). Remaining work: unify success response shape.

## Implementation Status
Error classes and HTTP mapping implemented (`apiErrors.ts`). All failing scenarios observed in tests return `{ error: { code, message }, errors?[] }`. Success responses remain heterogeneous (not yet wrapped in a standard envelope), matching deferred checklist items.

### Verified By
- Integration tests hitting validation, not found, conflict, cycle scenarios
- Playwright tests capturing validation and cycle errors

### Current Gaps / Tech Debt
- Standard success envelope not adopted
- No correlation / request ID injection
- No structured logging integration (console only)

## Outstanding / Deferred
- Adopt success envelope `{ ok:true, ... }` (evaluate impact on existing clients)
- Introduce correlation ID middleware & include in error payloads
- Add error metrics (counts by code) for observability
