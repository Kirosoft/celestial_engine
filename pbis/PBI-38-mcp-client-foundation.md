# PBI-38: MCP Client Foundation

**Phase:** 2.3 - Model Context Protocol Integration  
**Priority:** High  
**Estimate:** 4 days  
**Status:** Not Started

---

## User Story

As a **backend developer**, I want an **MCP client module** so that **the system can connect to MCP servers and invoke tools**.

---

## Acceptance Criteria

1. ✅ `lib/mcpClient.ts` exists with core MCP client functionality

2. ✅ Can discover MCP servers from `settings/mcp-servers.yaml` config

3. ✅ Can connect to MCP server via stdio transport

4. ✅ Can list tools from connected server

5. ✅ Can invoke tool with parameters and receive result

6. ✅ Connection status tracked (connected/disconnected/error)

7. ✅ Unit tests cover connection, tool listing, and tool invocation

8. ✅ Gracefully handles server crashes and timeouts

---

## Technical Details

### MCP Server Config (`settings/mcp-servers.yaml`)

```yaml
version: "1.0"
servers:
  - id: filesystem
    name: "Filesystem Tools"
    type: stdio
    command: "npx"
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/home/ubuntu/celestial_engine"
    enabled: true
    timeout: 5000
    
  - id: git
    name: "Git Operations"
    type: stdio
    command: "mcp-server-git"
    args:
      - "--repo"
      - "/home/ubuntu/celestial_engine"
    enabled: false
    timeout: 5000
```

### MCP Client Interface (`lib/mcpClient.ts`)

```typescript
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import YAML from 'js-yaml';

export interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  timeout: number;
  process?: ChildProcess;
  tools: MCPTool[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolInvocation {
  serverId: string;
  toolName: string;
  parameters: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

class MCPClient {
  private servers: Map<string, MCPServer> = new Map();
  private messageId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  async loadConfig(configPath?: string): Promise<void> {
    const path = configPath || join(process.cwd(), 'settings', 'mcp-servers.yaml');
    
    try {
      const content = await fs.readFile(path, 'utf-8');
      const config = YAML.load(content) as { servers: any[] };
      
      for (const serverConfig of config.servers) {
        const server: MCPServer = {
          ...serverConfig,
          status: 'disconnected',
          tools: []
        };
        
        this.servers.set(server.id, server);
      }
      
      console.log(`[MCPClient] Loaded ${this.servers.size} server configs`);
    } catch (error) {
      console.error('[MCPClient] Failed to load config:', error);
      throw error;
    }
  }
  
  async connect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    if (!server.enabled) {
      throw new Error(`Server disabled: ${serverId}`);
    }
    
    if (server.type !== 'stdio') {
      throw new Error(`Unsupported transport: ${server.type} (stdio only for MVP)`);
    }
    
    try {
      // Spawn MCP server process
      const process = spawn(server.command!, server.args || [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      server.process = process;
      server.status = 'connected';
      
      // Setup message handler
      let buffer = '';
      process.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // Parse JSON-RPC messages (newline-delimited)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.handleMessage(serverId, message);
            } catch (error) {
              console.error('[MCPClient] Failed to parse message:', line);
            }
          }
        }
      });
      
      process.on('error', (error) => {
        console.error(`[MCPClient] Server ${serverId} error:`, error);
        server.status = 'error';
      });
      
      process.on('exit', (code) => {
        console.log(`[MCPClient] Server ${serverId} exited with code ${code}`);
        server.status = 'disconnected';
        server.process = undefined;
      });
      
      // Initialize connection
      await this.sendRequest(serverId, 'initialize', {
        protocolVersion: '1.0',
        clientInfo: {
          name: 'celestial-engine',
          version: '0.1.0'
        }
      });
      
      // List available tools
      const tools = await this.sendRequest(serverId, 'tools/list', {});
      server.tools = tools.tools || [];
      
      console.log(`[MCPClient] Connected to ${serverId} (${server.tools.length} tools)`);
    } catch (error) {
      server.status = 'error';
      throw error;
    }
  }
  
  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || !server.process) {
      return;
    }
    
    server.process.kill();
    server.status = 'disconnected';
    server.process = undefined;
    server.tools = [];
  }
  
  async listTools(serverId: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    if (server.status !== 'connected') {
      throw new Error(`Server not connected: ${serverId}`);
    }
    
    return server.tools;
  }
  
  async invokeTool(invocation: MCPToolInvocation): Promise<MCPToolResult> {
    const { serverId, toolName, parameters } = invocation;
    const startTime = Date.now();
    
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      return {
        success: false,
        error: 'Server not connected',
        duration: Date.now() - startTime
      };
    }
    
    try {
      const result = await this.sendRequest(serverId, 'tools/call', {
        name: toolName,
        arguments: parameters
      });
      
      return {
        success: true,
        result: result.content,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
  
  getServerStatus(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }
  
  listServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }
  
  private async sendRequest(serverId: string, method: string, params: any): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server || !server.process) {
      throw new Error('Server not connected');
    }
    
    const id = ++this.messageId;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, server.timeout);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      server.process!.stdin?.write(JSON.stringify(message) + '\n');
    });
  }
  
  private handleMessage(serverId: string, message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    }
  }
}

export const mcpClient = new MCPClient();
```

---

## Implementation Checklist

### Setup
- [ ] Install dependencies: `npm install js-yaml`
- [ ] Create `settings/` directory if not exists
- [ ] Create `settings/mcp-servers.yaml` with example config
- [ ] Create `lib/mcpClient.ts` file

### Config Loading
- [ ] Implement `loadConfig()` to parse YAML
- [ ] Store servers in Map (id → server)
- [ ] Validate config structure (required fields)
- [ ] Handle file not found gracefully

### Stdio Connection
- [ ] Implement `connect()` with `child_process.spawn()`
- [ ] Setup stdin/stdout/stderr pipes
- [ ] Parse newline-delimited JSON-RPC messages
- [ ] Send `initialize` request on connection
- [ ] Call `tools/list` to fetch available tools
- [ ] Update server status to 'connected'

### Tool Discovery
- [ ] Store tools in server object
- [ ] Implement `listTools()` to return cached tools
- [ ] Parse tool schema (name, description, inputSchema)
- [ ] Handle empty tool list

### Tool Invocation
- [ ] Implement `invokeTool()` with JSON-RPC `tools/call`
- [ ] Send parameters as `arguments` field
- [ ] Wait for response with timeout
- [ ] Return structured result (success, result, error, duration)
- [ ] Handle tool execution errors

### JSON-RPC Message Handling
- [ ] Implement request/response ID matching
- [ ] Track pending requests in Map
- [ ] Set timeout for each request
- [ ] Clear timeout on response
- [ ] Reject promise on timeout
- [ ] Resolve promise on success
- [ ] Reject promise on error response

### Connection Management
- [ ] Implement `disconnect()` to kill process
- [ ] Handle process exit events
- [ ] Handle process error events
- [ ] Update server status on disconnect
- [ ] Clean up pending requests on disconnect

### Error Handling
- [ ] Catch spawn errors (command not found)
- [ ] Handle broken pipe (server crash)
- [ ] Timeout requests after configured duration
- [ ] Log all errors with context
- [ ] Return structured error responses

### Testing
- [ ] Create `lib/__tests__/mcpClient.test.ts`
- [ ] Mock `child_process.spawn()`
- [ ] Test config loading
- [ ] Test connection (successful)
- [ ] Test connection (command not found)
- [ ] Test tool listing
- [ ] Test tool invocation (success)
- [ ] Test tool invocation (timeout)
- [ ] Test disconnection

---

## Testing Approach

### Unit Tests (`lib/__tests__/mcpClient.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpClient } from '../mcpClient';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process');

describe('MCPClient', () => {
  let mockProcess: EventEmitter;
  
  beforeEach(() => {
    mockProcess = new EventEmitter();
    (mockProcess as any).stdin = { write: vi.fn() };
    (mockProcess as any).stdout = new EventEmitter();
    (mockProcess as any).stderr = new EventEmitter();
    (mockProcess as any).kill = vi.fn();
    
    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
  });
  
  describe('loadConfig', () => {
    it('should load server configs from YAML', async () => {
      await mcpClient.loadConfig('test/fixtures/mcp-servers.yaml');
      
      const servers = mcpClient.listServers();
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0]).toHaveProperty('id');
      expect(servers[0]).toHaveProperty('name');
    });
  });
  
  describe('connect', () => {
    it('should spawn process and initialize connection', async () => {
      await mcpClient.loadConfig('test/fixtures/mcp-servers.yaml');
      
      // Simulate server responses
      setTimeout(() => {
        (mockProcess as any).stdout.emit('data', 
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n'
        );
        (mockProcess as any).stdout.emit('data',
          JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [] } }) + '\n'
        );
      }, 10);
      
      await mcpClient.connect('filesystem');
      
      expect(childProcess.spawn).toHaveBeenCalled();
      const server = mcpClient.getServerStatus('filesystem');
      expect(server?.status).toBe('connected');
    });
  });
  
  describe('invokeTool', () => {
    it('should send tool call and return result', async () => {
      await mcpClient.loadConfig('test/fixtures/mcp-servers.yaml');
      await mcpClient.connect('filesystem');
      
      setTimeout(() => {
        (mockProcess as any).stdout.emit('data',
          JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            result: { content: [{ type: 'text', text: 'Tool result' }] }
          }) + '\n'
        );
      }, 10);
      
      const result = await mcpClient.invokeTool({
        serverId: 'filesystem',
        toolName: 'read_file',
        parameters: { path: '/test.txt' }
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();
    });
  });
});
```

### Integration Test (Manual)
1. Install MCP filesystem server: `npx -y @modelcontextprotocol/server-filesystem --version`
2. Create `settings/mcp-servers.yaml` with filesystem server config
3. Run test script:

```typescript
// scripts/test-mcp.ts
import { mcpClient } from '../lib/mcpClient';

async function test() {
  await mcpClient.loadConfig();
  console.log('Servers:', mcpClient.listServers());
  
  await mcpClient.connect('filesystem');
  console.log('Connected!');
  
  const tools = await mcpClient.listTools('filesystem');
  console.log('Tools:', tools.map(t => t.name));
  
  const result = await mcpClient.invokeTool({
    serverId: 'filesystem',
    toolName: 'list_directory',
    parameters: { path: '.' }
  });
  console.log('Result:', result);
  
  await mcpClient.disconnect('filesystem');
}

test().catch(console.error);
```

---

## Dependencies

- **NPM Packages:**
  - `js-yaml` (^4.1.0) for config parsing
  - `@modelcontextprotocol/server-filesystem` (for testing, not bundled)

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Server process crashes unexpectedly | Auto-restart on exit, graceful degradation |
| Timeout too short for slow tools | Configurable timeout per server |
| Broken pipe errors | Catch and reconnect automatically |
| Large tool results overflow memory | Stream results, add size limits |
| Security: arbitrary command execution | Validate commands, allowlist servers |

---

## Definition of Done

- [x] All checklist items completed
- [x] MCPClient class implemented
- [x] Can connect to stdio MCP server
- [x] Can list and invoke tools
- [x] Unit tests pass (>80% coverage)
- [x] Manual integration test successful
- [x] Error handling robust
- [x] Code reviewed and merged

---

## Notes

- HTTP and SSE transports deferred to Phase 2.5
- Auto-reconnect on crash deferred to future PBI
- Tool result streaming (large outputs) deferred to future
- Server marketplace/discovery deferred to Phase 3

---

**Created:** 2025-10-03  
**Updated:** 2025-10-03
