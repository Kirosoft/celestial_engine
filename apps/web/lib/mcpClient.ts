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
  private pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  /**
   * Load MCP server configurations from YAML file
   */
  async loadConfig(configPath?: string): Promise<void> {
    const repoRoot = process.env.REPO_ROOT || join(process.cwd(), '..', '..');
    const path = configPath || join(repoRoot, 'settings', 'mcp-servers.yaml');

    try {
      const content = await fs.readFile(path, 'utf-8');
      const config = YAML.load(content) as { version: string; servers: any[] };

      if (!config.servers || !Array.isArray(config.servers)) {
        throw new Error('Invalid config: servers array required');
      }

      for (const serverConfig of config.servers) {
        if (!serverConfig.id || !serverConfig.name || !serverConfig.type) {
          console.warn('[MCPClient] Skipping invalid server config:', serverConfig);
          continue;
        }

        const server: MCPServer = {
          id: serverConfig.id,
          name: serverConfig.name,
          type: serverConfig.type,
          command: serverConfig.command,
          args: serverConfig.args || [],
          url: serverConfig.url,
          enabled: serverConfig.enabled !== false,
          timeout: serverConfig.timeout || 5000,
          status: 'disconnected',
          tools: [],
        };

        this.servers.set(server.id, server);
      }

      console.log(`[MCPClient] Loaded ${this.servers.size} server configs from ${path}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`[MCPClient] Config not found: ${path}`);
        return;
      }
      console.error('[MCPClient] Failed to load config:', error);
      throw error;
    }
  }

  /**
   * Connect to an MCP server by spawning its process
   */
  async connect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (!server.enabled) {
      throw new Error(`Server disabled: ${serverId}`);
    }

    if (server.status === 'connected') {
      console.log(`[MCPClient] Server ${serverId} already connected`);
      return;
    }

    if (server.type !== 'stdio') {
      throw new Error(`Unsupported transport: ${server.type} (stdio only for MVP)`);
    }

    if (!server.command) {
      throw new Error(`No command specified for server: ${serverId}`);
    }

    try {
      console.log(`[MCPClient] Spawning ${serverId}: ${server.command} ${server.args?.join(' ')}`);

      // Spawn MCP server process
      const process = spawn(server.command, server.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      server.process = process;

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
              console.error('[MCPClient] Failed to parse message:', line.slice(0, 100));
            }
          }
        }
      });

      process.stderr?.on('data', (chunk) => {
        console.error(`[MCPClient] ${serverId} stderr:`, chunk.toString().trim());
      });

      process.on('error', (error) => {
        console.error(`[MCPClient] Server ${serverId} error:`, error);
        server.status = 'error';
        this.rejectAllPending(serverId, error);
      });

      process.on('exit', (code) => {
        console.log(`[MCPClient] Server ${serverId} exited with code ${code}`);
        server.status = 'disconnected';
        server.process = undefined;
        this.rejectAllPending(serverId, new Error(`Server exited with code ${code}`));
      });

      // Initialize connection
      await this.sendRequest(serverId, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'celestial-engine',
          version: '0.1.0',
        },
      });

      // List available tools
      const toolsResponse = await this.sendRequest(serverId, 'tools/list', {});
      server.tools = toolsResponse.tools || [];

      server.status = 'connected';
      console.log(`[MCPClient] Connected to ${serverId} (${server.tools.length} tools)`);
    } catch (error: any) {
      server.status = 'error';
      if (server.process) {
        server.process.kill();
        server.process = undefined;
      }
      throw new Error(`Failed to connect to ${serverId}: ${error.message}`);
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || !server.process) {
      return;
    }

    console.log(`[MCPClient] Disconnecting from ${serverId}`);
    server.process.kill('SIGTERM');
    server.status = 'disconnected';
    server.process = undefined;
    server.tools = [];
    this.rejectAllPending(serverId, new Error('Server disconnected'));
  }

  /**
   * List tools available from a connected server
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (server.status !== 'connected') {
      throw new Error(`Server not connected: ${serverId} (status: ${server.status})`);
    }

    return server.tools;
  }

  /**
   * Invoke a tool on an MCP server
   */
  async invokeTool(invocation: MCPToolInvocation): Promise<MCPToolResult> {
    const { serverId, toolName, parameters } = invocation;
    const startTime = Date.now();

    const server = this.servers.get(serverId);
    if (!server) {
      return {
        success: false,
        error: `Server not found: ${serverId}`,
        duration: Date.now() - startTime,
      };
    }

    if (server.status !== 'connected') {
      return {
        success: false,
        error: `Server not connected: ${serverId} (status: ${server.status})`,
        duration: Date.now() - startTime,
      };
    }

    try {
      const result = await this.sendRequest(serverId, 'tools/call', {
        name: toolName,
        arguments: parameters,
      });

      return {
        success: true,
        result: result.content || result,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get status of a specific server
   */
  getServerStatus(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * List all configured servers
   */
  listServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Disconnect all servers (cleanup)
   */
  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.servers.keys());
    await Promise.all(serverIds.map((id) => this.disconnect(id)));
  }

  /**
   * Reset client state (for testing)
   */
  reset(): void {
    // Kill all processes
    for (const server of this.servers.values()) {
      if (server.process) {
        server.process.kill('SIGTERM');
      }
    }
    
    // Clear all state
    this.servers.clear();
    this.messageId = 0;
    
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client reset'));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Send a JSON-RPC request to a server
   */
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
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method} (${server.timeout}ms)`));
      }, server.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        server.process!.stdin?.write(JSON.stringify(message) + '\n');
      } catch (error: any) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new Error(`Failed to write to server: ${error.message}`));
      }
    });
  }

  /**
   * Handle incoming JSON-RPC message from server
   */
  private handleMessage(serverId: string, message: any): void {
    // Handle response to a request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    // Handle notification (no response expected)
    if (message.method && !message.id) {
      console.log(`[MCPClient] ${serverId} notification: ${message.method}`, message.params);
      return;
    }

    // Unexpected message
    console.warn(`[MCPClient] ${serverId} unexpected message:`, message);
  }

  /**
   * Reject all pending requests for a server (on disconnect/error)
   */
  private rejectAllPending(serverId: string, error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }
}

// Singleton instance
export const mcpClient = new MCPClient();
