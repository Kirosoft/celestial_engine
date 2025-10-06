# Phase 2 Planning - Prompt Templates & MCP Integration

**Status:** 🔵 Planning  
**Target Start:** October 2025  
**Estimated Duration:** 4-6 weeks

---

## Phase 2 Goals

Build on Phase 1's stable foundation to deliver:

### 1. Prompt Template Library 📝
Organize and version-control reusable prompt templates following GitSpec standards:
- Standardized directory structure (`prompts/` with metadata)
- Template discovery and loading mechanism
- Variable placeholders with type hints
- Version tracking and template inheritance
- Built-in library of common patterns (summarization, extraction, analysis, code review, etc.)

### 2. LLM Node Template Integration 🔌
Make templates first-class citizens in LLM nodes:
- Template picker in Inspector (dropdown/search)
- Live preview with variable substitution
- Template parameter validation
- Hot reload when templates change on disk
- Template composition (include/extend patterns)
- Save custom templates from Inspector

### 3. Model Context Protocol (MCP) Support 🛠️
Enable LLM agents to discover and use MCP tools:
- MCP server discovery (local + remote)
- Tool schema introspection
- Dynamic tool availability in LLM context
- Tool invocation with parameter validation
- Result streaming back to graph
- Built-in MCP servers (filesystem, database, web search, git)
- MCP node type for explicit tool calls
- Agent mode for LLM nodes (autonomous tool selection)

---

## Implementation Phases

### Phase 2.1: Prompt Template Infrastructure (Week 1-2)

#### 2.1.1: GitSpec-Compliant Directory Structure
**Goal:** Establish standardized prompt template organization

**Directory Layout:**
```
prompts/
├── .promptspec.yaml              # GitSpec metadata
├── library/                      # Built-in templates
│   ├── summarization/
│   │   ├── article.md
│   │   ├── code.md
│   │   └── conversation.md
│   ├── extraction/
│   │   ├── entities.md
│   │   ├── key-points.md
│   │   └── structured-data.md
│   ├── analysis/
│   │   ├── sentiment.md
│   │   ├── complexity.md
│   │   └── comparison.md
│   ├── code-review/
│   │   ├── security.md
│   │   ├── performance.md
│   │   └── style.md
│   └── generation/
│       ├── documentation.md
│       ├── test-cases.md
│       └── explanation.md
├── user/                         # User-created templates
└── shared/                       # Team/project templates
```

**GitSpec `.promptspec.yaml` Format:**
```yaml
version: "1.0"
metadata:
  name: "Celestial Engine Prompt Library"
  description: "Curated templates for LLM nodes"
  author: "Celestial Team"
  license: "MIT"
templates:
  - id: "summarization/article"
    path: "library/summarization/article.md"
    version: "1.0.0"
    tags: ["summarization", "text", "article"]
    variables:
      - name: "content"
        type: "string"
        required: true
        description: "Article text to summarize"
      - name: "max_words"
        type: "number"
        default: 100
        description: "Maximum summary length"
  # ... more templates
```

**Tasks:**
- [x] Define `.promptspec.yaml` schema (GitSpec alignment)
- [ ] Create initial library of 15-20 templates covering common use cases
- [ ] Implement YAML parser for template metadata
- [ ] Add template validation (check variables, frontmatter)
- [ ] Write template authoring guide

#### 2.1.2: Template Discovery & Loading
**Goal:** Runtime discovery and parsing of templates

**API Endpoints:**
- `GET /api/prompts/templates` - List all available templates
- `GET /api/prompts/templates/[id]` - Get template content + metadata
- `POST /api/prompts/templates` - Create new template
- `PUT /api/prompts/templates/[id]` - Update template
- `DELETE /api/prompts/templates/[id]` - Delete template

**Backend (`lib/templateRepo.ts`):**
```typescript
interface PromptTemplate {
  id: string;
  path: string;
  version: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  content: string;
  variables: TemplateVariable[];
  examples?: TemplateExample[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

// Core functions
async function listTemplates(filters?: { category?: string; tags?: string[] }): Promise<PromptTemplate[]>
async function getTemplate(id: string): Promise<PromptTemplate>
async function createTemplate(template: Partial<PromptTemplate>): Promise<PromptTemplate>
async function updateTemplate(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate>
async function deleteTemplate(id: string): Promise<void>
async function reloadTemplates(): Promise<void> // Watch for file changes
```

**Template File Format (Markdown with YAML Frontmatter):**
```markdown
---
id: summarization/article
name: Article Summarizer
version: 1.0.0
category: summarization
tags: [text, article, summary]
variables:
  - name: content
    type: string
    required: true
    description: Article text to summarize
  - name: max_words
    type: number
    default: 100
    validation:
      min: 50
      max: 500
examples:
  - input:
      content: "Long article text..."
      max_words: 150
    output: "Concise summary..."
---

# Article Summarization

Summarize the following article in approximately {{max_words}} words.
Focus on the main points and key takeaways.

**Article:**
{{content}}

**Summary ({{max_words}} words max):**
```

**Tasks:**
- [ ] Implement `templateRepo.ts` with CRUD operations
- [ ] Add frontmatter parsing (gray-matter or similar)
- [ ] Create template validation schema
- [ ] Add file watcher for hot reload
- [ ] Build template cache (lazy load, TTL)
- [ ] Write unit tests for template parsing

#### 2.1.3: Template Version Control & Inheritance
**Goal:** Support template evolution and composition

**Features:**
- Template versioning (semver)
- Template inheritance (`extends: parent-template-id`)
- Variable overrides in child templates
- Changelog tracking in `.promptspec.yaml`

**Tasks:**
- [ ] Add version comparison logic
- [ ] Implement template inheritance resolver
- [ ] Create migration guide for breaking changes
- [ ] Add deprecation warnings for old templates

---

### Phase 2.2: LLM Node Template Integration (Week 2-3)

#### 2.2.1: LLM Schema Updates
**Goal:** Extend LLM node schema to support templates

**Schema Changes (`schemas/nodes/LLM.schema.json`):**
```json
{
  "properties": {
    "props": {
      "properties": {
        "templateId": {
          "type": "string",
          "description": "Selected template ID (e.g., 'summarization/article')"
        },
        "templateVariables": {
          "type": "object",
          "description": "Key-value pairs for template variables",
          "additionalProperties": true
        },
        "useTemplate": {
          "type": "boolean",
          "default": false,
          "description": "Whether to use template or raw prompt"
        },
        "prompt": {
          "type": "string",
          "description": "Raw prompt (used when useTemplate=false)"
        }
      }
    }
  }
}
```

**Execution Logic:**
```typescript
// In lib/execution.ts LLM executor
if (node.props.useTemplate && node.props.templateId) {
  const template = await getTemplate(node.props.templateId);
  const rendered = renderTemplate(template.content, {
    ...node.props.templateVariables,
    ...latestMap // Merge with input variables
  });
  finalPrompt = rendered;
} else {
  finalPrompt = node.props.prompt; // Existing behavior
}
```

**Tasks:**
- [ ] Update LLM.schema.json with template fields
- [ ] Modify LLM executor to support template rendering
- [ ] Add template variable merging logic (inputs + explicit vars)
- [ ] Implement Mustache/Handlebars rendering
- [ ] Add validation (check required template variables present)

#### 2.2.2: Inspector Template Picker
**Goal:** Rich UI for template selection and configuration

**UI Components:**
- **Template Browser** - Searchable/filterable list with categories
- **Variable Editor** - Form fields based on template variable definitions
- **Live Preview** - Real-time rendering with current variable values
- **Template Creator** - Save current prompt as new template

**Inspector Layout:**
```
┌─────────────────────────────────────┐
│ LLM Node: Summarizer                │
├─────────────────────────────────────┤
│ Mode: ● Template  ○ Raw Prompt      │
├─────────────────────────────────────┤
│ Template: [summarization/article ▼] │
│   📄 Article Summarizer v1.0.0       │
│   Tags: text, article, summary       │
├─────────────────────────────────────┤
│ Variables:                           │
│   content: [From input: file] ✓      │
│   max_words: [150        ] (50-500)  │
├─────────────────────────────────────┤
│ Preview:                             │
│ ┌─────────────────────────────────┐ │
│ │ Summarize the following article │ │
│ │ in approximately 150 words...   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [Save Template] [Revert] [Apply]    │
└─────────────────────────────────────┘
```

**Tasks:**
- [ ] Create TemplatePicker component (dropdown with search)
- [ ] Build TemplateVariableEditor component (dynamic form)
- [ ] Add PromptPreview component (syntax highlighting)
- [ ] Implement "Save as Template" dialog
- [ ] Add template favorites/recently used
- [ ] Create template browsing modal (full library view)

#### 2.2.3: Template Hot Reload
**Goal:** Instant updates when templates change on disk

**Implementation:**
- File watcher on `prompts/` directory
- Broadcast reload event via existing `graph:refresh-request` pattern
- Inspector re-fetches template content on change
- Show notification: "Template updated - reload?"

**Tasks:**
- [ ] Add chokidar file watcher to API
- [ ] Emit template change events
- [ ] Update Inspector to listen for changes
- [ ] Add optimistic UI updates (debounce)
- [ ] Show diff view for template changes (optional)

---

### Phase 2.3: Model Context Protocol (MCP) Integration (Week 3-6)

#### 2.3.1: MCP Architecture Overview
**Goal:** Understand and design MCP integration layer

**MCP Concepts:**
- **MCP Server** - Standalone process exposing tools via stdio/HTTP/SSE
- **Tool** - Function with schema (name, description, parameters, returns)
- **Resource** - File, database entry, API endpoint
- **Prompt** - Reusable template (overlaps with Phase 2.1)
- **Client** - Celestial Engine as MCP client

**Integration Points:**
1. **Discovery** - Find available MCP servers (config file + auto-detect)
2. **Connection** - Stdio, HTTP, or SSE transport
3. **Tool Listing** - Introspect available tools from each server
4. **Tool Invocation** - Call tool with parameters, stream results
5. **Context Building** - Inject tool schemas into LLM context
6. **Agent Mode** - Let LLM decide which tools to call

**Tasks:**
- [ ] Research MCP protocol spec (Anthropic docs)
- [ ] Design MCP client architecture
- [ ] Choose transport layer (prioritize stdio for local servers)
- [ ] Define MCP configuration schema

#### 2.3.2: MCP Server Discovery & Connection
**Goal:** Detect and connect to MCP servers

**Configuration File (`settings/mcp-servers.yaml`):**
```yaml
servers:
  - id: filesystem
    name: "Filesystem Tools"
    type: stdio
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/ubuntu/celestial_engine"]
    enabled: true
    
  - id: database
    name: "PostgreSQL Tools"
    type: stdio
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    enabled: false
    
  - id: web-search
    name: "Web Search (Brave)"
    type: http
    url: "http://localhost:8080/mcp"
    apiKey: "${BRAVE_API_KEY}"
    enabled: false
    
  - id: git
    name: "Git Operations"
    type: stdio
    command: "mcp-server-git"
    args: ["--repo", "/home/ubuntu/celestial_engine"]
    enabled: true
```

**Backend (`lib/mcpClient.ts`):**
```typescript
interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'http' | 'sse';
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

class MCPClient {
  async discoverServers(): Promise<MCPServer[]>
  async connect(serverId: string): Promise<void>
  async disconnect(serverId: string): Promise<void>
  async listTools(serverId: string): Promise<MCPTool[]>
  async invokeTool(serverId: string, toolName: string, args: any): Promise<any>
  async listResources(serverId: string): Promise<MCPResource[]>
  async readResource(serverId: string, uri: string): Promise<string>
}
```

**API Endpoints:**
- `GET /api/mcp/servers` - List configured servers + status
- `POST /api/mcp/servers/[id]/connect` - Connect to server
- `POST /api/mcp/servers/[id]/disconnect` - Disconnect
- `GET /api/mcp/servers/[id]/tools` - List available tools
- `POST /api/mcp/servers/[id]/tools/[name]` - Invoke tool

**Tasks:**
- [ ] Implement `mcpClient.ts` with stdio transport
- [ ] Add HTTP/SSE transports (optional for Phase 2)
- [ ] Create MCP server config parser
- [ ] Build server status monitoring (health checks)
- [ ] Add connection retry logic with backoff
- [ ] Write integration tests with mock MCP server

#### 2.3.3: Tool Schema Introspection
**Goal:** Fetch and parse tool definitions from MCP servers

**Tool Schema Storage:**
- Cache tool schemas in memory (refresh every 5min or on reconnect)
- Store in `.awb/mcp-cache.json` for offline access
- Index by server ID + tool name

**Tool Availability in LLM Context:**
```typescript
// When LLM node executes, inject available tools
const availableTools = await mcpClient.getAllTools(); // Across all connected servers

const toolsContext = availableTools.map(t => ({
  name: t.name,
  description: t.description,
  parameters: t.inputSchema
}));

// Add to LLM system prompt or as OpenAI function/tool definitions
const systemPrompt = `You have access to these tools:\n${JSON.stringify(toolsContext, null, 2)}`;
```

**Tasks:**
- [ ] Implement tool schema caching
- [ ] Build tool index (searchable by name/description)
- [ ] Add tool schema validation
- [ ] Create tool documentation generator
- [ ] Build tool usage statistics (track which tools called)

#### 2.3.4: MCP Node Type (Explicit Tool Calls)
**Goal:** New node type for direct tool invocation

**Schema (`schemas/nodes/MCPTool.schema.json`):**
```json
{
  "$id": "https://celestial-engine.dev/schemas/MCPTool.schema.json",
  "title": "MCP Tool Call",
  "type": "object",
  "properties": {
    "props": {
      "type": "object",
      "properties": {
        "serverId": {
          "type": "string",
          "description": "MCP server ID"
        },
        "toolName": {
          "type": "string",
          "description": "Tool to invoke"
        },
        "parameters": {
          "type": "object",
          "description": "Tool parameters",
          "additionalProperties": true
        },
        "streaming": {
          "type": "boolean",
          "default": false,
          "description": "Stream results incrementally"
        }
      },
      "required": ["serverId", "toolName"]
    }
  }
}
```

**Execution Logic:**
```typescript
// In lib/execution.ts
if (node.type === 'MCPTool') {
  const { serverId, toolName, parameters } = node.props;
  const result = await mcpClient.invokeTool(serverId, toolName, parameters);
  
  await emitFrom(node.id, 'result', result, {
    diagnostics: [{
      type: 'mcp_tool_invoked',
      toolName,
      serverId,
      duration: result.duration
    }]
  });
}
```

**Tasks:**
- [ ] Create MCPTool schema
- [ ] Implement MCPTool executor
- [ ] Add parameter mapping from input edges
- [ ] Support streaming results (SSE-like updates)
- [ ] Create custom MCPTool UI component (server/tool picker)
- [ ] Add error handling (tool not found, param validation)

#### 2.3.5: Agent Mode for LLM Nodes
**Goal:** Let LLM autonomously choose and invoke tools

**LLM Schema Extension:**
```json
{
  "properties": {
    "props": {
      "properties": {
        "agentMode": {
          "type": "boolean",
          "default": false,
          "description": "Enable autonomous tool selection"
        },
        "allowedServers": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Whitelist of MCP servers agent can use"
        },
        "maxToolCalls": {
          "type": "number",
          "default": 5,
          "description": "Max tool invocations per execution"
        },
        "toolCallStrategy": {
          "type": "string",
          "enum": ["sequential", "parallel", "adaptive"],
          "default": "sequential"
        }
      }
    }
  }
}
```

**Agent Execution Flow:**
```
1. LLM receives prompt + tool schemas
2. LLM returns tool call request (OpenAI function calling format)
3. Executor invokes tool via MCP client
4. Tool result appended to context
5. LLM called again with result (loop until done or max iterations)
6. Final response emitted to next node
```

**Implementation:**
```typescript
async function executeLLMAgent(node: NodeFile, input: any) {
  const tools = await getAvailableTools(node.props.allowedServers);
  let conversationHistory = [{ role: 'user', content: input.prompt }];
  let toolCallCount = 0;
  
  while (toolCallCount < node.props.maxToolCalls) {
    const response = await callLLM({
      messages: conversationHistory,
      tools: tools.map(t => ({ type: 'function', function: t })),
      tool_choice: 'auto'
    });
    
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        const result = await mcpClient.invokeTool(
          toolCall.function.serverId,
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );
        
        conversationHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
        
        toolCallCount++;
      }
    } else {
      // No more tool calls, return final answer
      return response.content;
    }
  }
  
  throw new Error(`Agent exceeded max tool calls (${node.props.maxToolCalls})`);
}
```

**Tasks:**
- [ ] Extend LLM executor with agent loop
- [ ] Implement tool call history tracking
- [ ] Add tool call diagnostics (visualize decision tree)
- [ ] Support parallel tool calls (Promise.all)
- [ ] Add agent safety checks (prevent infinite loops)
- [ ] Create agent execution timeline UI
- [ ] Write agent integration tests (mock tools)

#### 2.3.6: Built-in MCP Servers
**Goal:** Package common MCP servers with Celestial Engine

**Servers to Bundle:**
1. **Filesystem** (`@modelcontextprotocol/server-filesystem`)
   - read_file, write_file, list_directory, search_files
   
2. **Git** (custom or community)
   - git_status, git_diff, git_log, git_commit
   
3. **Web Search** (Brave API)
   - web_search, get_page_content
   
4. **Database** (SQLite wrapper)
   - query, insert, update, delete, list_tables

**Installation Script:**
```bash
# In apps/web/scripts/setup-mcp.sh
npx -y @modelcontextprotocol/server-filesystem --version
npx -y @modelcontextprotocol/server-postgres --version
# ... etc
```

**Tasks:**
- [ ] Create MCP server install script
- [ ] Add default MCP config with common servers
- [ ] Document each server's capabilities
- [ ] Add UI for enabling/disabling servers
- [ ] Create "MCP Marketplace" (discover community servers)

---

## Testing Strategy

### Template System Tests
- [ ] Unit: Template parsing (frontmatter, variables)
- [ ] Unit: Template rendering (Mustache substitution)
- [ ] Unit: Template validation (required vars, types)
- [ ] Integration: Template CRUD via API
- [ ] Integration: LLM node with template execution
- [ ] E2E: Template picker UI workflow

### MCP Integration Tests
- [ ] Unit: MCP client connection (stdio transport)
- [ ] Unit: Tool schema parsing
- [ ] Unit: Tool invocation with mock results
- [ ] Integration: MCP server discovery
- [ ] Integration: Tool call from LLM agent
- [ ] E2E: Full agent workflow (prompt → tool call → result)

---

## Success Metrics

### Phase 2.1 (Templates)
- [ ] 20+ curated templates in library
- [ ] Template hot reload working (<1s latency)
- [ ] Templates used in 80% of LLM nodes
- [ ] User can create custom template in <2min

### Phase 2.2 (LLM Integration)
- [ ] Template picker loads in <500ms
- [ ] Live preview updates in <100ms
- [ ] Zero template variable validation errors in production
- [ ] Template inheritance works for 3-level hierarchies

### Phase 2.3 (MCP)
- [ ] 4+ MCP servers connected simultaneously
- [ ] Tool discovery completes in <2s
- [ ] Agent mode successfully calls tools 95% of the time
- [ ] MCP tool call latency <5s avg
- [ ] Zero crashes from malformed tool responses

---

## Phase 2 Constraints

- Maintain backward compatibility with Phase 1 graphs
- No breaking schema changes (use version field for LLM updates)
- Keep file-based storage for templates (version-controllable)
- All new features must have tests (unit + integration + E2E)
- Template system must work offline (no external dependencies)
- MCP servers must be sandboxed (no unrestricted filesystem access)
- Tool call loops must have timeout protection

---

## Dependencies & Prerequisites

### New NPM Packages
```json
{
  "gray-matter": "^4.0.3",          // YAML frontmatter parsing
  "handlebars": "^4.7.8",           // Template rendering (Mustache superset)
  "chokidar": "^3.5.3",             // File watching for hot reload
  "js-yaml": "^4.1.0",              // YAML config parsing
  "@modelcontextprotocol/sdk": "*"  // Official MCP SDK (TBD version)
}
```

### System Requirements
- Node.js 18+ (for stdio child process handling)
- Git (for versioning templates)
- Optional: Docker (for sandboxed MCP servers)

### Environment Variables
```bash
BRAVE_API_KEY=xxx              # For web search MCP server
DATABASE_URL=xxx               # For database MCP server
MCP_SERVERS_CONFIG=path.yaml   # Override default MCP config
```

---

## Development Milestones

### Milestone 1: Template Foundation (Week 1)
- [ ] `.promptspec.yaml` schema finalized
- [ ] 10 initial templates created
- [ ] `templateRepo.ts` CRUD operations working
- [ ] Template API endpoints functional
- [ ] Basic template picker UI

**Deliverable:** Can create/list/view templates via API

### Milestone 2: LLM Integration (Week 2)
- [ ] LLM schema extended with template fields
- [ ] Template rendering in LLM executor
- [ ] Inspector template picker with live preview
- [ ] Hot reload working for template changes
- [ ] "Save as Template" button functional

**Deliverable:** Can execute LLM node using template from library

### Milestone 3: MCP Discovery (Week 3-4)
- [ ] MCP config format defined
- [ ] Stdio transport client implemented
- [ ] Server connection/disconnection working
- [ ] Tool schema introspection functional
- [ ] MCP server status UI (System Settings panel)

**Deliverable:** Can connect to local MCP server and list tools

### Milestone 4: MCP Tool Calls (Week 4-5)
- [ ] MCPTool node type created
- [ ] Tool invocation working (stdio)
- [ ] Parameter validation implemented
- [ ] Tool results flowing to downstream nodes
- [ ] Error handling for failed tool calls

**Deliverable:** Can explicitly call MCP tool from graph

### Milestone 5: Agent Mode (Week 5-6)
- [ ] LLM agent loop implemented
- [ ] Tool call history tracking
- [ ] OpenAI function calling integration
- [ ] Agent safety limits (max iterations)
- [ ] Agent execution timeline visualization

**Deliverable:** LLM node autonomously chooses and calls tools

### Milestone 6: Polish & Documentation (Week 6)
- [ ] Complete template library (20 templates)
- [ ] Bundle 4 common MCP servers
- [ ] Write user guide (templates + MCP)
- [ ] API reference documentation
- [ ] Video tutorial (5min walkthrough)

**Deliverable:** Production-ready Phase 2 release

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP protocol changes | Medium | High | Pin SDK version, monitor Anthropic announcements |
| Tool call security issues | Medium | Critical | Sandbox servers, parameter validation, audit logs |
| Template performance (large library) | Low | Medium | Lazy loading, pagination, search indexing |
| Agent infinite loops | High | Medium | Max iterations, timeout, circuit breaker |
| Template variable injection bugs | Medium | High | Strict parsing, whitelist allowed syntax |
| MCP server crashes | Medium | Low | Auto-restart, graceful degradation, offline mode |

---

## Open Questions

1. **Template Syntax:** Mustache vs Handlebars vs custom?
   - **Recommendation:** Handlebars (superset of Mustache with conditionals/loops)

2. **MCP Server Sandboxing:** Docker vs native process isolation?
   - **Recommendation:** Native process + restricted filesystem paths for Phase 2, Docker for Phase 3

3. **Agent Tool Selection:** Always autonomous or user approval required?
   - **Recommendation:** Opt-in agent mode per node, explicit approval for Phase 2.1

4. **Template Versioning:** Git-based or custom versioning?
   - **Recommendation:** Git-based (commit hashes in `.promptspec.yaml`)

5. **MCP HTTP Transport:** Support in Phase 2 or defer?
   - **Recommendation:** Stdio only for Phase 2, HTTP in Phase 2.5 if demand exists

6. **Tool Call Observability:** How detailed should timeline view be?
   - **Recommendation:** Show tool name, params, duration, result preview (full details on click)

---

## Next Steps (Week 1 - Kick-off)

1. **Create Initial Structure**
   - [ ] Create `prompts/library/` directories
   - [ ] Write `.promptspec.yaml` template
   - [ ] Scaffold `lib/templateRepo.ts`
   - [ ] Add template API routes

2. **Technical Spikes**
   - [ ] Prototype MCP stdio connection (2 hours)
   - [ ] Test Handlebars template rendering (1 hour)
   - [ ] Research OpenAI function calling (1 hour)

3. **Template Library**
   - [ ] Draft 5 initial templates (summarization, extraction, code review)
   - [ ] Define variable naming conventions
   - [ ] Write template authoring guide

4. **Team Alignment**
   - [ ] Review Phase 2 spec with stakeholders
   - [ ] Assign tasks (backend vs frontend vs testing)
   - [ ] Set up weekly progress sync

---

## Future Phases (Post Phase 2)

### Phase 2.5: Enhanced MCP Features
- HTTP/SSE transport support
- MCP server marketplace (discover community servers)
- Tool composition (chain multiple tools)
- Persistent tool call cache
- Tool usage analytics

### Phase 3: Advanced Prompting
- Prompt optimization suggestions (via LLM meta-analysis)
- A/B testing for templates (track performance)
- Template recommendation engine
- Prompt debugging tools (token counter, cost estimator)
- Multi-modal template support (images, audio)

---

_Phase 2 detailed specification completed October 3, 2025._
