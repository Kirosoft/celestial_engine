## PBI-26: Logs & Events Panel

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

## Implementation Status
Not started. Event log infrastructure absent (depends on PBI-17), so panel not begun.

## Outstanding / Deferred
- Implement `/api/events` tail endpoint
- Build polling panel with filter UI
- Add event type color coding for readability
