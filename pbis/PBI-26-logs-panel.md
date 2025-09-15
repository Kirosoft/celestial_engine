---
id: PBI-26
title: Logs & Events Panel
phase: 2
status: not-started
priority: medium
estimate: 3
owner: TBA
created: 2025-09-12
updated: 2025-09-15
dependsOn: [PBI-17, PBI-25]
---

## Goal

Goal
----
Show recent command events (tail of events.log) for observability and debugging.

Description
-----------
Add panel listing last N (e.g., 50) events with timestamp, type, nodeId(s). Poll `/api/events?limit=50` or implement SSE later. Allow filtering by event type.

Acceptance Criteria
-------------------
- Panel shows events after issuing commands via console or UI actions.
- Filtering hides non-matching events in real-time.
- Empty state when no events.

Tests
-----
- Playwright: issue command → event appears in panel.
- Filter apply reduces visible list appropriately.

Dependencies
------------
- Event log reader endpoint.

Out of Scope
------------
- Live streaming (SSE/websocket) (future).

## Implementation Checklist
- [ ] /api/events?limit=50 endpoint
- [ ] Panel UI w/ scroll & virtualization (if needed)
- [ ] Polling logic w/ backoff
- [ ] Filter by type UI
- [ ] Event type color coding
- [ ] Empty state display
- [ ] Playwright: command triggers visible event
- [ ] Playwright: filter hides non-matching

## Implementation Status
Not started.

## Outstanding / Deferred
- SSE / streaming updates
- Advanced filtering (nodeId search)
