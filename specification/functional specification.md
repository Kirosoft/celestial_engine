# Agentic Workflow Builder — Functional & Technical Specification (v0.1)

**Status:** Draft
**Tenant:** Single-tenant (internal tool)
**Client:** Web app (React/Next.js)
**Mode:** **Repo‑Local MVP (default)**; Cloud mode optional later
**Backend:** Local Next.js (API routes on Bun/Node)
**Runtime:** Bun (JavaScript/TypeScript)
**Persistence:** Git repository filesystem (**JSON node files**), optional Cosmos in Cloud mode
**LLM:** OpenAI-compatible interface + OpenAPI-based provider config
**VCS/IO:** GitHub via PAT (direct branch writes) + optional GitHub MCP-based IO nodes
**Commands:** Explicit JSON schema, idempotent
**Design-time Plan:** Plan node materializes new Task nodes when played at design time

---

## 1) Goals & Non-Goals

**Goals (Repo‑Local MVP)**

* Lightweight local website you run **inside a GitHub repo clone** to manage **JSON node/agent definitions** and local resources.
* Single Next.js app (UI + API routes) that reads/writes files under the repo root; no external DB/queues.
* Git-aware authoring: list files, edit with live preview, diff & commit, branch switch/create.
* Command-first edits: UI actions translate to idempotent commands which mutate files/frontmatter.
* Optional LLM assist (OpenAI-compatible) for generating agent/task MD, commit messages, and code stubs.

**Non-Goals (MVP)**

* Distributed execution engine, durable queues, or cloud scaling. (Kept for Cloud mode later.)
* Multi-tenant auth.

---

## 2) Core Concepts

* **Project**: Container for graphs, resources, provider configs, and runs.
* **Graph**: DAG of **Nodes** connected by **Edges**; versioned via command event stream.
* **Node**: Typed processing unit with strongly-typed **ports**, **props**, **state**, **artifacts**, and **runtime** behavior.
* **Ports**: `inputs[]` and `outputs[]`, each with a `dataType` (e.g., `text`, `json`, `image`, `fileRef`, `artifactRef`).
* **Edge**: Connects `source.nodeId.outputPort -> target.nodeId.inputPort`.
* **Command**: Idempotent, LLM-friendly JSON instruction; validated against a JSON Schema.
* **Event**: Append-only change record derived from a command (used for audit, undo/redo, replay).
* **Run**: Execution instance (design-time or live) with logs, token usage, costs, artifacts, and status.
* **Artifact**: Produced outputs (files, images, JSON) persisted and addressable.
* **Provider**: External system config (LLM, OpenAPI tool set, GitHub repo, MCP server, etc.).

---

## 3) Graph Semantics

* **DAG constraint**: Cycles prevented at commit time. (Future: opt-in cycles with guards.)
* **Evaluation**: Dataflow style; *Play from node* executes its downstream subgraph using available upstream cache.
* **Caching**: Node-level memoization keyed by `{nodeId, propsHash, inputsHash, providerVersion}` with manual/auto invalidation.
* **Design-time vs Live**:

  * **Design-time run**: executes special nodes (e.g., **Plan**) that **emit commands** to mutate the graph (materialize nodes/edges/props). Changes are reviewed/applied transactionally.
  * **Live evaluate**: runs the graph (or subgraph) without mutating topology; produces outputs/artifacts.

---

## 4) Node Types (Initial Set)

1. **LLM Node**

   * **Purpose**: Prompt completion, tool calls, structured output.
   * **Props**: `model`, `system`, `promptTemplate`, `temperature`, `maxOutputTokens`, `jsonSchema?`, `toolChoice?`, `parallelToolCalls?`.
   * **Inputs**: `context(text|json)`, `images(image[])`, `toolsResults(json)`.
   * **Outputs**: `text`, `json`, `toolCalls(json)`.

2. **Plan Node** (Design-time materializer)

   * **Purpose**: Generate a task breakdown and **emit graph-mutation commands** that create **Task Nodes** and wire them.
   * **Props**: `plannerModel`, `maxTasks`, `taskSchema`, `placementStrategy` (grid/cluster), `connectTo` (nodeId/port).
   * **Inputs**: `goal(text|json)`, `context(text|json)`.
   * **Outputs**: `plan(json)`, `commands(json)` (preview), `diff(summary)`.
   * **Behavior**: On *Play (Design)* → produce commands (`add_node`, `connect`, `update_node`, etc.). User can **preview diff** then **Apply**.

3. **Task Node**

   * **Purpose**: Concrete work unit produced by Plan; defaults to an LLM or Tool step.
   * **Props**: `title`, `description`, `tool?`, `acceptanceCriteria?`, `costCap?`.
   * **Ports**: `in: context`, `out: result`.

4. **Tool Call Node**

   * **Purpose**: Call an OpenAPI-described endpoint (auto-generated form) or invoke MCP tool.
   * **Props**: `providerId`, `operationId` (OpenAPI), `paramsSchema`, `authRef`.
   * **Inputs**: `params(json)`, `files(fileRef[])`.
   * **Outputs**: `response(json|fileRef)`.

5. **Router/Branch Node**

   * **Purpose**: Conditional routing based on JSONPath/expression.
   * **Props**: `expression`, `cases[]`, `defaultCase?`.

6. **Merge Node**

   * **Purpose**: Join multiple inputs (first-ready, zip, concat, reduce).
   * **Props**: `strategy`.

7. **Code Node (JS/TS)**

   * **Purpose**: Deterministic transform with sandboxing (Deno VM or Cloudflare-style isolate).
   * **Props**: `code`, `timeoutMs`, `memoryMb`.

8. **GitHub Input Node**

   * **Purpose**: Read files from repo.
   * **Props**: `repo`, `branch`, `pathGlob`, `as` (`text|image|json|files`), `encoding?`.
   * **Outputs**: `files(fileRef[])`, `text[]`, `images[]`.

9. **GitHub Output Node**

   * **Purpose**: Write/patch files; commit directly to configured branch.
   * **Props**: `repo`, `branch`, `writeMode` (`create|append|patch|replace`), `pathTemplate`, `commitMessageTemplate`.
   * **Inputs**: `files(fileRef[])`, `text`, `json`.
   * **Outputs**: `commitSha`, `paths[]`.

10. **Eval/Assert Node**

    * **Purpose**: Checks quality gates; can fail the run.
    * **Props**: `validators[]` (regex, JSON Schema, custom JS).

*All nodes share: `id`, `type`, `name`, `position`, `props`, `ioSchema`, `ui.hints`.*

---

## 5) Command DSL (LLM-Friendly, Idempotent)

### 5.1 Command Envelope

```json
{
  "schema": "https://example.com/spec/command-envelope.v1",
  "command_id": "uuid",
  "action": "add_node",
  "payload": {},
  "actor": "user|agent",
  "idempotency_key": "uuid",
  "expected_version": 42,
  "timestamp": "2025-09-10T12:34:56Z",
  "project_id": "proj_123",
  "graph_id": "graph_main"
}
```

* **Idempotency**: `idempotency_key` + `(project_id, graph_id)` dedupe window. If re-applied with same payload → no-op.
* **Optimistic concurrency**: `expected_version` must match current graph version; else **409** with hint to fetch latest.

### 5.2 Actions & Payload Schemas (subset)

* `add_node`

```json
{
  "id": "node_abc",
  "type": "Plan",
  "name": "Plan Features",
  "position": {"x":120,"y":340},
  "props": {"plannerModel":"gpt-4o-mini","maxTasks":8}
}
```

* `remove_node`

```json
{"id": "node_abc"}
```

* `update_node_props`

```json
{"id": "node_abc", "propsPatch": {"maxTasks":12}}
```

* `move_node`

```json
{"id": "node_abc", "position": {"x":220, "y":340}}
```

* `connect`

```json
{"source": {"nodeId":"n1","port":"out"}, "target": {"nodeId":"n2","port":"in"}}
```

* `disconnect`

```json
{"edgeId": "e_001"}
```

* `play_node`

```json
{"nodeId":"n1", "mode":"design|live", "inputs": {"context":"Build a feature list"}}
```

* `configure_provider`

```json
{
  "providerType": "openai_compatible|openapi_tools|github|mcp",
  "providerId": "prov_openai",
  "config": {"baseUrl":"https://api.openai.com/v1","apiKeyRef":"secret:openai","defaultModel":"gpt-4o-mini"}
}
```

* `set_secret`

```json
{"key":"secret:openai","valueRef":"vault://kv/OPENAI_API_KEY"}
```

> All commands conform to published JSON Schemas; UI auto-completes and validates.

### 5.3 Events (examples)

* `NodeAdded`, `NodeRemoved`, `NodeUpdated`, `NodeMoved`, `EdgeAdded`, `EdgeRemoved`,
* `NodePlayed`, `RunStarted`, `RunOutputChunk`, `RunCompleted`, `RunFailed`,
* `ProviderConfigured`, `SecretsBound`, `GitCommitCreated`.

---

## 6) LLM & Tools Integration

### 6.1 OpenAI-Compatible (Responses API)

* **Config Dialog** fields: `baseUrl`, `apiKey (secret)`, `organization?`, `project?`, `defaultModel`, `timeout`, `parallelToolCalls (bool)`, `forceJson (bool)`, `jsonSchema?`.
* **Runtime**: Supports text + image inputs; tool calls via OpenAI function-calling; structured outputs via JSON Schema.
* **Playground**: Test prompt with streaming; save as LLM Node template.

### 6.2 OpenAPI Tool Providers

* Import an **OpenAPI (3.x)** spec (JSON/YAML). The system generates **Tool Call Nodes** with parameter forms from schemas.
* **Auth**: API key/Bearer in headers via secret binding.
* **Operation registry**: `operationId` lookup; create nodes via **Add Node → Tools (from OpenAPI)**.

### 6.3 MCP Support (optional path)

* Register an **MCP server** (e.g., GitHub MCP). Nodes can call MCP tools by name.
* Provides a consistent transport for tool discovery and invocation.

---

## 7) Git/GitHub Integration (Local First)

* **Repo Root**: tool runs with `REPO_ROOT` pointing to your local clone; all file ops are path‑scoped/sanitized.

* **Git Ops (local)**: via `simple-git` for status, add, commit, branch, log. Optional push using system Git.

* **Remote (optional)**: configure origin and PAT for push; otherwise commit locally only.

* **Paths** (convention):

  * `nodes/` — **JSON node files** (`<type>-<randomid>.json`, filename === node `id`)
  * `schemas/nodes/` — JSON Schemas for node **types** (used by UI toolbox + validation)
  * `resources/` — images, data files used by nodes/agents
  * `tools/` — OpenAPI specs or MCP manifests
  * `.awb/` — app config (JSON), cache, indexes

* **Diff Preview**: file diff before save/commit.

* **Write Modes**: create/replace/append/patch (JSON patch on node files supported).

---

## 8) Runtime (Repo‑Local MVP)

* **Single process**: Next.js app provides UI and API routes; no background workers.
* **Commands**: Applying a command mutates files (frontmatter/content) and updates an in‑memory index; changes are committed on demand.
* **Preview**: Commands can run in **dry‑run** to show a file diff before persisting.
* **Optional Live Evaluate**: When enabled, selected agents can call an LLM using configured OpenAI base URL/key.

---

## 9) Persistence & Abstraction Layer

* **Primary store**: Git‑tracked filesystem under `REPO_ROOT`.
* **Index**: `.awb/index.json` caches file metadata (IDs, slugs, titles) rebuilt on startup.
* **Abstractions**: `FileRepo` (safe FS ops), `GitRepo` (add/commit/branches), `AgentRepo` (frontmatter + MD), `ToolRepo` (OpenAPI specs).
* **Cloud mode**: Cosmos/Blob adapters remain defined but are out of MVP path.

---

## 10) API Surface (Bun/TypeScript Service)

**HTTP**

* `GET /api/schemas` → list node type schemas (name, title, version, \$id)
* `GET /api/nodes` → list nodes (id, type, name, position)
* `GET /api/nodes/:id` → read node JSON
* `POST /api/nodes` → **create** node (type) ⇒ returns new id `<type>-<randomid>.json`
* `PUT /api/nodes/:id` → **update** node JSON (validated against type schema)
* `POST /api/nodes/:id/rename` → **rename** node (changes filename/id; updates all edge refs)
* `DELETE /api/nodes/:id` → remove node (and clean up inbound/outbound edge refs)
* `POST /api/edges` → add edge `{ sourceId, targetId, sourcePort?, targetPort?, kind }`
* `DELETE /api/edges/:sourceId/:edgeId` → remove edge from source node
* `PUT /api/edges/:sourceId/:edgeId` → update edge (e.g., change kind)
* `POST /api/nodes/:id/position` → update position `{ x, y }`
* `GET /api/static?path=...` → safe static file read (schemas)
* `POST /api/git/commit` → stage/commit paths with message

**Streaming**

* (optional) `GET /runs/{runId}/stream` → SSE for future live-eval

**Auth**

* Local dev: none; optional basic token.

---

## 11) UI/UX (React/Next)

* **Canvas**: React Flow, pan/zoom, snap-to-grid, lasso select, keyboard shortcuts, mini-map.
* **Toolbar**: *Add Node*, *Connect*, *Play*, *Undo/Redo*, *Snapshot*, *Command Console*.
* **Node Cards**: title, type badge, status pill, *Play* button, ports, context menu.
* **Inspector**: schema-driven forms for node props; raw JSON toggle.
* **Command Console**: paste/edit JSON commands, validate, apply; shows server response/events.
* **Logs Panel**: token stream, tool I/O, errors, cost, artifacts with preview (markdown, images).
* **Diff Modal**: for Plan node design-time preview and GitHub writes.
* **Provider Config Dialogs**:

  * OpenAI-compatible LLM: base URL, API key, model picker.
  * OpenAPI import: file/URL; list operations; enable/disable; auth bindings.
  * GitHub: repo, branch, PAT secret.

---

## 12) Observability, Safety, Cost

* **Run Logs**: prompts, responses, tool calls, timing, token usage, cost estimates.
* **PII/Content Filters**: Optional pre/post filters on LLM nodes.
* **Cost Caps**: per-run and per-node limits (abort on exceed).
* **Audit**: Full command/event history with diff viewer.

---

## 13) Versioning, Snapshots, Undo/Redo

* **Snapshots**: Named materialized graph states.
* **Undo/Redo**: Command history with labels; revert via inverse commands or snapshot restore.
* **Export/Import**: Graph JSON (including nodes, edges, provider refs) for portability.

---

## 14) Testing Strategy

* **Golden tests** for nodes with fixture inputs/expected outputs.
* **Replay**: Re-run a prior run against a different model/provider to compare outputs.
* **Schema tests**: Validate all commands/events against JSON Schemas.

---

## 15) Security & Secrets

* **Secrets**: Stored only in Azure Key Vault; referenced as `secret:*` keys in config/commands.
* **Least-privilege**: GitHub PAT scope minimized. Network egress allowlists for Code nodes.
* **CSP** and SSRF protections in backend HTTP clients.

---

## 16) Data Models (TypeScript Interfaces – excerpt)

```ts
// Graph
export interface Graph { id: string; projectId: string; version: number; nodes: Node[]; edges: Edge[]; }
export interface Position { x: number; y: number }
export interface Port { name: string; dataType: 'text'|'json'|'image'|'fileRef'|'artifactRef'; }
export interface Node { id: string; type: string; name: string; position: Position; props: any; inputs: Port[]; outputs: Port[]; ui?: any }
export interface Edge { id: string; source: {nodeId: string; port: string}; target: {nodeId: string; port: string} }

// Commands
export interface CommandEnvelope<A extends string=string, P=any> {
  schema: string; command_id: string; action: A; payload: P; actor: 'user'|'agent';
  idempotency_key: string; expected_version: number; timestamp: string; project_id: string; graph_id: string;
}

// Run
export interface Run { id: string; projectId: string; graphId: string; mode: 'design'|'live'; nodeId: string; status: 'queued'|'running'|'succeeded'|'failed'; logs: Log[]; artifacts: ArtifactRef[]; startedAt: string; finishedAt?: string }
```

---

## 17) Example Flows

### 17.1 Create a Plan and Materialize Tasks

1. User adds a **Plan Node** via UI (internally emits `add_node`).
2. User *Play (Design)* on Plan → engine calls configured LLM to produce a task list.
3. Plan node returns a list of **commands** (e.g., several `add_node` Task nodes + `connect` edges).
4. UI shows **Diff Modal**; user clicks **Apply** → batch `POST /commands` (transactional).

**Example `commands` emitted by Plan**

```json
[
  {"action":"add_node","payload":{"id":"task_spec","type":"Task","name":"Spec Draft","position":{"x":420,"y":320},"props":{"title":"Write spec","description":"Draft v1"}}},
  {"action":"connect","payload":{"source":{"nodeId":"plan1","port":"plan"},"target":{"nodeId":"task_spec","port":"in"}}}
]
```

### 17.2 GitHub Write

* Subgraph produces Markdown; **GitHub Output Node** previews patch → commit to `main` with message template.

### 17.3 Play From Node (Live)

* Select a **Task Node** and click **Play** → downstream executes with cached upstream results; stream output to Logs Panel.

---

## 18) Local Resources (MVP)

* **Process (dev):** `bun --cwd apps/web dev` runs UI + API routes.
* **Process (package):** `awb serve --repo . --port 5173` serves embedded SPA + API.
* **Env:** `.env.local` with `REPO_ROOT=/absolute/path/to/repo`, optional `OPENAI_*` if LLM features are enabled.
* **Dependencies:** Node/Bun runtime; `simple-git`, `fast-glob`, **`ajv`**, optional `nanoid`.

---

## 19) Directory Structure (Repo‑Local MVP)

```
/apps
  /web            # Next.js (UI + API routes) for development
  /server         # Hono server (API) + static UI hosting for packaged distribution
  /web-spa        # Vite/React SPA build of the UI for embedding in /server
  /components     # (shared if desired)
  /shared         # shared schemas/types (optional)

nodes/            # <type>-<randomid>.json (filename === id)
schemas/nodes/    # <type>.schema.json (per-node-type JSON Schema)
resources/        # images, data
.awb/             # runtime index, cache, config.json
```

---

## 20) JSON Schemas (sketch)

* **Envelope**: `command-envelope.v1.json`
* **Actions**: `add_node.v1.json`, `remove_node.v1.json`, `update_node_props.v1.json`, `move_node.v1.json`, `connect.v1.json`, `disconnect.v1.json`, `play_node.v1.json`, `configure_provider.v1.json`, `set_secret.v1.json`.
* **Validation**: AJV with formats; schema `$id` stable and versioned.

---

## 21) Roadmap (Post-v0.1)

* Realtime co-editing (Yjs/CRDT) and presence.
* Branch/merge graphs; multi-environment deploy.
* Scheduling and triggers; webhooks.
* PR-based GitHub writes; review workflow.
* Guardrails (policy engine), eval harness, test coverage reports.
* Cycle support with watchdogs; backpressure tuning.

---

## 22) Open Questions (to revisit later)

* Do we need per-node secrets vs project-level bindings? (default: project-level)
* Should Plan node also **update** existing nodes (not only add/connect)? (default: allowed with `update_node_props`)
* How aggressive should caching be across model version changes? (default: cache-key includes `model@version`)

---

## 23) Acceptance Criteria (v0.1)

* Create/edit a graph entirely via UI, with **commands** logged and replayable.
* Add **Plan Node**, play (design), preview and apply materialized tasks.
* Configure OpenAI-compatible provider and successfully stream from LLM Node.
* Read files from GitHub and write commits to a branch from Output Node.
* Play from any node (live), see streaming logs, cost, and artifacts.
* Undo/redo last 10 graph edits; snapshot and restore graph.

---

## 24) Deployment (Bun on Azure Container Apps)

**API/Worker Images**

```dockerfile
# Dockerfile.api
FROM oven/bun:latest AS base
WORKDIR /app
COPY apps/api/package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY apps/api .
RUN bun build src/index.ts --compile --outfile /app/bin/api
CMD ["/app/bin/api"]
```

```dockerfile
# Dockerfile.worker
FROM oven/bun:latest AS base
WORKDIR /app
COPY apps/worker/package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY apps/worker .
RUN bun build src/index.ts --compile --outfile /app/bin/worker
CMD ["/app/bin/worker"]
```

**Config (env)**

* `COSMOS_CONN_STR`, `COSMOS_DB`, `COSMOS_CONTAINER_PREFIX`
* `AZURE_SERVICEBUS_CONNECTION_STRING`
* `BLOB_CONN_STR`
* `KEYVAULT_URI`
* `OPENAI_BASE_URL`, `OPENAI_API_KEY` (via Key Vault ref)
* `GITHUB_PAT` (via Key Vault ref)

**Ingress & Scaling**

* Expose API on HTTPS; autoscale on RPS/CPU.
* Worker scaled by Service Bus queue length.

**Observability**

* OTEL SDK → Application Insights; include runId, graphId, nodeId in spans.

---

---

## 25) Starter Scaffold (Repo‑Local, JSON Nodes)

> Dev uses Next.js app router. Packaged distribution uses `apps/server` (Hono) + `apps/web-spa` (Vite) so end‑users get a single self‑contained server.

### 25.0 CLI & Server (packaged)

`apps/server/src/index.ts`

```ts
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { LocalFsProvider } from '../../web/lib/storage';
import { registerNodeRoutes } from './routes/nodes';
import { registerSchemaRoutes } from './routes/schemas';

const app = new Hono();
registerSchemaRoutes(app);
registerNodeRoutes(app);
app.get('*', serveStatic({ root: './public' })); // serve SPA

const port = Number(process.env.PORT || 5173);
console.log(`[awb] serving on http://localhost:${port}`);
export default { port, fetch: app.fetch };
```

`apps/server/public/` ← contains built SPA from `/apps/web-spa/dist`.

`apps/server/bin/cli.ts`

```ts
#!/usr/bin/env bun
import { $ } from 'bun';
import { existsSync } from 'fs';
const args = Object.fromEntries(process.argv.slice(2).map(a=>a.startsWith('--')?a.slice(2).split('='):[a,a]));
process.env.REPO_ROOT = args.repo || process.cwd();
process.env.PORT = args.port || '5173';
if (!existsSync(process.env.REPO_ROOT + '/schemas/nodes')) { console.log('[awb] No schemas/nodes dir; run `awb init` to scaffold.'); }
await $`bun run apps/server/start.ts`;
```

**Build scripts**

* `bun --cwd apps/web-spa build` → outputs to `apps/web-spa/dist`
* `cp -r apps/web-spa/dist/* apps/server/public/`
* `bun build apps/server/src/index.ts --compile --outfile awb` *(optional single‑file binary)*

---

## 26) UI Components (Toolbox, RHS Schema Form, Canvas with Edge Kind)

### 26.1 Web `package.json` additions (`apps/web/package.json`)

```json
{
  "name": "awb-web",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "reactflow": "^11.10.2",
    "@rjsf/core": "^5.22.2",
    "@rjsf/validator-ajv8": "^5.22.2",
    "ajv": "^8.17.1",
    "swr": "^2.2.5"
  }
}
```

### 26.2 Toolbox Component (`apps/web/components/Toolbox.tsx`)

```tsx
'use client';
import useSWR from 'swr';

const fetcher = (u:string)=>fetch(u).then(r=>r.json());

export function Toolbox({ onAdd }: { onAdd: (type: string)=>void }) {
  const { data } = useSWR('/api/schemas', fetcher);
  const items = data || [];
  return (
    <div className="p-2 space-y-2 overflow-auto h-full">
      <div className="font-semibold">Toolbox</div>
      {items.map((s:any)=> (
        <div key={s.$id} className="border rounded p-2 flex items-center justify-between">
          <div>
            <div className="font-medium">{s.title || s.type}</div>
            <div className="text-xs text-gray-500">{s.$id}</div>
          </div>
          <button className="px-2 py-1 border rounded" onClick={()=>onAdd(s.type)}>Add</button>
        </div>
      ))}
    </div>
  );
}
```

### 26.3 RHS Schema Form (`apps/web/components/SchemaFormPanel.tsx`)

```tsx
'use client';
import { useEffect, useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

export function SchemaFormPanel({ node, onSaved }: { node: any; onSaved: (n:any)=>void }) {
  const [schema, setSchema] = useState<any>(null);
  useEffect(()=>{
    if (!node) return;
    fetch(`/api/schemas`).then(r=>r.json()).then((list:any[])=>{
      const s = list.find(x=> (x.title || x.type) === node.type);
      if (!s) return setSchema(null);
      // load full schema file from its $id path under repo (fallback to `/schemas/nodes/<type>.schema.json` via public route if exposed)
      fetch(`/api/static?path=${encodeURIComponent(`schemas/nodes/${node.type}.schema.json`)}`)
        .then(r=>r.json()).then(setSchema).catch(()=>setSchema(null));
    });
  }, [node?.type]);

  if (!node) return <div className="p-2 text-sm text-gray-500">Select a node to edit.</div>;
  if (!schema) return <div className="p-2 text-sm">No schema found for <b>{node.type}</b>.</div>;

  return (
    <div className="h-full overflow-auto p-2">
      <div className="font-semibold mb-2">Properties</div>
      <Form schema={schema} formData={node.props || {}} validator={validator} onSubmit={async (e)=>{
        const res = await fetch(`/api/nodes/${node.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ props: e.formData }) });
        const n = await res.json();
        onSaved(n);
      }}>
        <button className="mt-2 px-3 py-1 border rounded" type="submit">Save</button>
      </Form>
    </div>
  );
}
```

> Add a tiny route to read static schema files safely: `apps/web/app/api/static/route.ts` that proxies `REPO_ROOT` reads (path‑sanitized).

### 26.4 Canvas with Edge Kind (`apps/web/components/GraphCanvas.tsx`)

```tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

type NodeFile = { id:string; type:string; name?:string; position?:{x:number;y:number}; edges?:{ out: { id:string; kind:'flow'|'data'; targetId:string }[] } };

export function GraphCanvas({ activeId, onSelect, onEdgeChange }: { activeId?:string; onSelect:(n:any)=>void; onEdgeChange?:()=>void }) {
  const [rawNodes, setRawNodes] = useState<NodeFile[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  async function load() {
    const r = await fetch('/api/nodes'); const d = await r.json(); setRawNodes(d.nodes);
  }
  useEffect(()=>{ load(); },[]);

  useEffect(()=>{
    setNodes(rawNodes.map(n=> ({ id: n.id, data: { label: n.name || n.id }, position: n.position || { x: 100, y: 100 } })));
    const e = rawNodes.flatMap(src => (src.edges?.out || []).map(e => ({ id: e.id, source: src.id, target: e.targetId, label: e.kind })));
    setEdges(e as any);
  }, [rawNodes]);

  const onNodeDragStop = async (_:any, node:any)=>{
    await fetch(`/api/nodes/${node.id}/position`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(node.position) });
  };

  const onConnect = async (params:any)=>{
    // default kind flow; allow changing later by selecting edge
    await fetch('/api/edges', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sourceId: params.source, targetId: params.target, kind: 'flow' }) });
    await load();
    onEdgeChange?.();
  };

  const onEdgeClick = async (_:any, edge:any)=>{
    const next = edge.label === 'flow' ? 'data' : 'flow';
    await fetch(`/api/edges/${edge.source}/${edge.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ kind: next }) });
    await load();
  };

  return (
    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_,n)=>onSelect(rawNodes.find(r=>r.id===n.id))} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onEdgeClick={onEdgeClick}>
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}
```

### 26.5 Page Composition (`apps/web/app/page.tsx`)

```tsx
'use client';
import { useState } from 'react';
import { Toolbox } from '@/components/Toolbox';
import { GraphCanvas } from '@/components/GraphCanvas';
import { SchemaFormPanel } from '@/components/SchemaFormPanel';

export default function Page() {
  const [selected, setSelected] = useState<any>(null);

  const addNode = async (type:string)=>{
    const r = await fetch('/api/nodes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type, init: {} }) });
    const n = await r.json();
    setSelected(n);
  };

  return (
    <div className="grid grid-cols-12 h-screen">
      <div className="col-span-2 border-r"><Toolbox onAdd={addNode} /></div>
      <div className="col-span-7"><GraphCanvas onSelect={setSelected} /></div>
      <div className="col-span-3 border-l"><SchemaFormPanel node={selected} onSaved={setSelected} /></div>
    </div>
  );
}
```

### 26.6 Safe Static Read API (`apps/web/app/api/static/route.ts`)

```ts
import { LocalFsProvider } from '@/lib/storage';
const p = new LocalFsProvider();
export async function GET(req: Request) {
  const u = new URL(req.url);
  const rel = u.searchParams.get('path');
  if (!rel) return Response.json({ error: 'path_required' }, { status: 400 });
  const raw = await p.read(rel);
  try { return Response.json(JSON.parse(raw)); } catch { return new Response(raw, { headers: { 'Content-Type': 'text/plain' } }); }
}
```

---

---

## 27) Trackable Deliverable Features & Milestones

> Each item has an **ID**, short description, key **Acceptance Criteria (AC)**, and **Dependencies (Dep.)**. These map directly to GitHub Issues or a backlog. Ordered for a smooth build path.

### Milestone M0 — Self‑Contained Package/Server (run in any repo)

**M0-01 — CLI Wrapper & Repo Detection**
**AC:** Ship `awb` CLI (Node/Bun) that detects repo root (looks for `.git`, fallback to CWD or `--repo` flag). Prints resolved `REPO_ROOT` and port.
**Dep.:** none.

**M0-02 — Embedded Web UI Build**
**AC:** Provide a prebuilt UI bundle embedded in the package; served as static files by the server. No build step required for end‑users.
**Dep.:** M0-04.

**M0-03 — Self‑Contained Server**
**AC:** `awb serve --repo . --port 5173` starts an HTTP server exposing all `/api/*` endpoints and serves the UI at `/`. All file operations scoped to `REPO_ROOT`.
**Dep.:** M0-01, M1-01..M1-08.

**M0-04 — Dual Build Outputs**
**AC:** Add `apps/server` (Hono) that serves both the API and static UI. Keep Next.js for dev; SPA build (Vite) for packaged UI. Parity of API paths maintained.
**Dep.:** M1-07, M1-08.

**M0-05 — Docker Image**
**AC:** Publish `ghcr.io/<org>/awb:latest`. Running `docker run -p 5173:5173 -v $PWD:/repo -e REPO_ROOT=/repo ghcr.io/<org>/awb:latest` works with no extra setup.
**Dep.:** M0-03.

**M0-06 — Single‑File Binary (optional)**
**AC:** Bun‑compiled binaries for macOS/Linux/Windows: `awb` executable that serves API + UI without Node installed.
**Dep.:** M0-03.

**M0-07 — Init & Scaffold**
**AC:** `awb init` creates `schemas/nodes/` and `nodes/` if missing, seeds example schemas (`LLM`, `Plan`). Safe re‑run is idempotent.
**Dep.:** M1-02, M1-03.

**M0-08 — Config & Secrets**
**AC:** Config precedence: CLI flags > env > `.awb/config.json`. Supports `repo`, `port`, `host`. LLM keys optional.
**Dep.:** M0-01.

**M0-09 — README Generator**
**AC:** `awb init --readme` adds a short repo README section explaining how to run and where files live.
**Dep.:** M0-07.

---

### Cross‑Cutting Definition of Done

* **Validation:** All node `props` conform to their JSON Schema; invalid input is prevented in UI and API.
* **Persistence:** File operations are atomic per write and never escape `REPO_ROOT`.
* **Graph Integrity:** After any create/rename/delete, the canvas loads without dangling edge references.
* **UX:** No unhandled promise rejections; visible feedback on every mutate action.
* **Docs:** README covers setup, env, directory conventions, and how to add new node schemas.

### Nice‑to‑Have Backlog (Post‑M4)

* Edge inspector with custom metadata editing; ports visualization.
* Multi‑select move; align/snap tools; templated subgraphs.
* Import/export of graphs; bulk rename.
* Hot reload on external repo changes.

---

---

## 28) Self‑Contained Distribution & Install

### Supported installation modes

1. **CLI via npm (npx)**

* Install: `npx awb@latest serve --repo . --port 5173`
* Needs Node 18+ or Bun 1.1+. Ships with embedded UI; no build step.

2. **Docker image**

* `docker run --rm -p 5173:5173 -v $PWD:/repo -e REPO_ROOT=/repo ghcr.io/<org>/awb:latest`

3. **Single binary (optional)**

* Download `awb` for your OS, `chmod +x awb`, then run: `./awb serve --repo . --port 5173`.

### CLI commands

* `awb init` — scaffold `schemas/nodes/` and `nodes/` (idempotent). Option `--readme` adds usage to README.
* `awb serve --repo <path> --port <n>` — start server; logs resolved `REPO_ROOT` and API base.
* `awb open` — open browser to the running UI.
* `awb doctor` — checks directory layout and permissions.

### Config precedence

`flags (--repo/--port)` > env (`REPO_ROOT`, `PORT`) > `.awb/config.json`.

### Security

* All file ops use safe path joining within `REPO_ROOT`.
* No network required unless using LLM features.

### Acceptance Criteria (packaging)

* Running **any** of the three modes in a random local Git repo produces the same UI and working APIs, with all file changes committed to that repo only.
* First run prompts to `init` if directories/schemas are missing.

---
