# PBI-32 System Settings Panel

## Goal
Introduce a persistent, global "System Settings" panel for configuring environment-wide properties (e.g., LLM provider base URL, API key, default model, safety toggles) separate from per-node inspectors. This enables secure + centralized management of cross-cutting configuration consumed by executors and services.

## Motivation
- Avoid repeating credentials or base URLs in every LLM node
- Simplify switching between providers / backends
- Provide a foundation for future feature flags (streaming on/off, logging verbosity)
- Enable secure handling (redaction + masked display) for secrets like API keys

## Functional Scope (MVP)
1. New UI panel (sidebar or modal) accessible via a toolbar button (e.g., "Settings").
2. Backed by a JSON settings document persisted under a new repo path (e.g., `settings/system.json`).
3. Schema-based validation for the config object (SystemSettings.schema.json), including:
   - `llm`: { `baseUrl`, `apiKey`, `defaultModel`, `timeoutMs`, `useStreaming` }
   - `logging`: { `level` }
   - `features`: { `enableExperimental` }
4. API endpoints to read/update settings (`GET /api/system` / `PUT /api/system`).
5. Secret fields (e.g., `apiKey`) stored in plain JSON for now (encryption deferred) but masked in UI after save.
6. Basic form: text inputs, number inputs, boolean toggles; reuse existing inspector field components where practical.
7. Settings consumed at runtime by LLM executor (uses baseUrl, defaultModel, timeout, streaming flag).
8. Validation errors surfaced inline in the panel UI.

## Out of Scope (MVP)
- Encryption / secure keystore for secrets
- Versioning / history of settings
- Multi-environment (dev/prod) profiles
- Role-based access control
- Import/export settings bundle

## Non-Functional Requirements
- File persistence atomic (same temp write strategy as nodes)
- Fast load (cached after first load until invalidated by PUT)
- Redaction: API `GET /api/system` returns `apiKey: "***"` unless `?reveal=1` AND (future auth) authorized

## Data Model (Draft)
```ts
interface SystemSettings {
  llm: {
    baseUrl: string;          // e.g. https://api.openai.com/v1
    apiKey: string;           // stored raw, masked on read unless reveal
    defaultModel: string;     // fallback model if node leaves blank
    timeoutMs: number;        // per-request timeout
    useStreaming: boolean;    // enable streaming mode (future LLM impl)
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  features: {
    enableExperimental: boolean;
  };
}
```

## Schema Draft (SystemSettings.schema.json)
```jsonc
{
  "$id": "SystemSettings.schema.json",
  "title": "SystemSettings",
  "type": "object",
  "properties": {
    "llm": {
      "type": "object",
      "properties": {
        "baseUrl": { "type": "string", "default": "" },
        "apiKey": { "type": "string", "default": "" },
        "defaultModel": { "type": "string", "default": "gpt-3.5-turbo" },
        "timeoutMs": { "type": "number", "default": 60000, "minimum": 1000 },
        "useStreaming": { "type": "boolean", "default": false }
      },
      "required": ["baseUrl","apiKey"],
      "additionalProperties": false
    },
    "logging": {
      "type": "object",
      "properties": {
        "level": { "type": "string", "enum": ["debug","info","warn","error"], "default": "info" }
      },
      "required": ["level"],
      "additionalProperties": false
    },
    "features": {
      "type": "object",
      "properties": {
        "enableExperimental": { "type": "boolean", "default": false }
      },
      "required": ["enableExperimental"],
      "additionalProperties": false
    }
  },
  "required": ["llm","logging","features"],
  "additionalProperties": false
}
```

## MVP Implementation Slices

### Slice 1: Schema & Persistence
- [ ] Add `schemas/SystemSettings.schema.json`.
- [ ] Add repository module `lib/systemSettingsRepo.ts` with functions: `readSettings()`, `writeSettings(partial)`, merging & validation.
- [ ] Seed default file if missing at server start.

### Slice 2: API Endpoints
- [ ] `GET /api/system` returns settings (mask `apiKey` unless `?reveal=1`).
- [ ] `PUT /api/system` validates request body against schema; stores new version.
- [ ] Error handling: 400 on validation errors with details array.

### Slice 3: Executor Consumption
- [ ] Modify LLM executor to read system settings (baseUrl, defaultModel, timeout, streaming) at run invocation.
- [ ] Fallback to node-specific override if provided (node `props.model` overrides `defaultModel`).
- [ ] Add debug log line summarizing applied effective config.

### Slice 4: UI Panel
- [ ] Add top-bar button "Settings" opening side panel (portal / drawer component).
- [ ] Form auto-loads settings on open.
- [ ] Field components: text (baseUrl, defaultModel), password-like masked field (apiKey), number (timeoutMs), toggle (useStreaming, enableExperimental), select (logging.level).
- [ ] Masked apiKey: show placeholder `***` if non-empty; reveal toggle retrieves full value via `?reveal=1`.
- [ ] Save button (disabled if no changes / while saving) -> PUT -> optimistic update.
- [ ] Basic inline validation messages.

### Slice 5: Validation & Testing
- [ ] Unit: repo validation rejects bad enum, negative timeout.
- [ ] Integration: roundtrip GET -> PUT -> GET (ensure persistence + masking behavior).
- [ ] Integration: executor picks up changed defaultModel without server restart (cache invalidation or always fresh read).
- [ ] UI test: open panel, edit field, save, confirm persisted.

### Slice 6: Security & Redaction (MVP minimal)
- [ ] Ensure apiKey never logged in plain text (strip in any debug logs).
- [ ] Add redaction helper for safe logging of settings snapshot.

### Slice 7: Documentation
- [ ] README section: System Settings Panel (purpose, fields, precedence rules).
- [ ] Note on secret handling limitations (unencrypted at rest for now).

## Acceptance Criteria
1. System settings file auto-created if missing.
2. GET returns masked apiKey when populated (unless reveal flag used).
3. PUT with invalid shape returns 400 + validation details.
4. Updating defaultModel changes subsequent LLM executor behavior (observed in logs).
5. Timeout enforced (request aborted in executor when exceeded) – placeholder simulated if real HTTP not yet implemented.
6. UI panel allows editing & saving settings; save persists file.
7. apiKey never appears in console logs (masked or omitted).
8. Feature flag enableExperimental boolean value accessible to future components (exposed via GET).

## Deferred (Post-MVP)
- Encryption for apiKey
- Profiles / environment switching
- Undo / history of settings changes
- Import/export settings
- Role-based access control
- Schema-driven dynamic form generation

Status: Draft
Created: 2025-09-16

