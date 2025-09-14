# celestial_engine
Celestial Engine

## Testing
See [TESTING.md](./TESTING.md) for the full testing strategy (unit, integration, and Playwright end-to-end coverage, plus troubleshooting and future enhancements).

## Environment Variables

The application and test harness support a few environment variables to customize behavior:

- `SCHEMA_PATHS` (optional): Comma-separated list of glob patterns pointing to node schema JSON files. When unset, the loader searches `schemas/nodes/*.schema.json` (app local) and `../schemas/nodes/*.schema.json` (repo root). Example:
	- `SCHEMA_PATHS=schemas/nodes/*.schema.json,extra-schemas/**/*.schema.json`
	This can be used to point at generated or external schema directories without modifying source.

- `DEBUG_SCHEMAS` (optional): When set (to any non-empty value), enables verbose schema loader logging (patterns attempted, files loaded, and missing schema diagnostics). Leave unset for quiet operation during normal test runs.

Example (PowerShell):
```powershell
$env:SCHEMA_PATHS='schemas/nodes/*.schema.json,plugins/*/nodes/*.schema.json'
$env:DEBUG_SCHEMAS='1'
npm test
```

Example (Unix shells):
```bash
SCHEMA_PATHS='schemas/nodes/*.schema.json,plugins/*/nodes/*.schema.json' DEBUG_SCHEMAS=1 npm test
```

When both variables are absent, defaults provide minimal logging with built-in schema discovery.
