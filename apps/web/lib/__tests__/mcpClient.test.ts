import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mcpClient, MCPServer } from '../mcpClient';
import * as childProcess from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock child_process
vi.mock('child_process');

describe('MCPClient', () => {
  let mockProcess: EventEmitter & {
    stdin: { write: any };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: any;
  };

  beforeEach(() => {
    // Reset client state
    vi.clearAllMocks();

    // Create mock process
    mockProcess = Object.assign(new EventEmitter(), {
      stdin: {
        write: vi.fn((data: string) => {
          // Auto-respond to requests based on method
          const msg = JSON.parse(data.trim());
          setImmediate(() => {
            if (msg.method === 'initialize') {
              mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
            } else if (msg.method === 'tools/list') {
              mockProcess.stdout.emit(
                'data',
                JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } }) + '\n'
              );
            }
          });
        }),
      },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
    });

    vi.mocked(childProcess.spawn).mockReturnValue(mockProcess as any);
  });

  afterEach(async () => {
    // Cleanup: disconnect all servers and reset state
    await mcpClient.disconnectAll();
    mcpClient.reset();
  });

  describe('loadConfig', () => {
    it('should load server configs from YAML', async () => {
      // Create test config
      const testConfig = `version: "1.0"
servers:
  - id: test-server
    name: "Test Server"
    type: stdio
    command: "test-cmd"
    args: ["--test"]
    enabled: true
    timeout: 3000
`;
      const tmpDir = join(process.cwd(), '.test-mcp-config');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;

      await mcpClient.loadConfig();

      const servers = mcpClient.listServers();
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].id).toBe('test-server');
      expect(servers[0].name).toBe('Test Server');
      expect(servers[0].command).toBe('test-cmd');
      expect(servers[0].status).toBe('disconnected');

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });

    it('should handle missing config file gracefully', async () => {
      process.env.REPO_ROOT = '/nonexistent';
      await expect(mcpClient.loadConfig()).resolves.not.toThrow();
      delete process.env.REPO_ROOT;
    });

    it('should validate required fields', async () => {
      const invalidConfig = `version: "1.0"
servers:
  - name: "Missing ID"
    type: stdio
`;
      const tmpDir = join(process.cwd(), '.test-mcp-invalid');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), invalidConfig);

      process.env.REPO_ROOT = tmpDir;

      await mcpClient.loadConfig();
      const servers = mcpClient.listServers();
      expect(servers.length).toBe(0); // Invalid server should be skipped

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });
  });

  describe('connect', () => {
    beforeEach(async () => {
      const testConfig = `version: "1.0"
servers:
  - id: test-server
    name: "Test Server"
    type: stdio
    command: "test-cmd"
    enabled: true
    timeout: 3000
`;
      const tmpDir = join(process.cwd(), '.test-mcp-connect');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();
    });

    afterEach(async () => {
      await fs.rm(join(process.cwd(), '.test-mcp-connect'), { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });

    it('should spawn process and initialize connection', async () => {
      // Override stdin.write to return tools
      mockProcess.stdin.write = vi.fn((data: string) => {
        const msg = JSON.parse(data.trim());
        setImmediate(() => {
          if (msg.method === 'initialize') {
            mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
          } else if (msg.method === 'tools/list') {
            mockProcess.stdout.emit(
              'data',
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  tools: [
                    {
                      name: 'test_tool',
                      description: 'A test tool',
                      inputSchema: { type: 'object', properties: {} },
                    },
                  ],
                },
              }) + '\n'
            );
          }
        });
      });

      await mcpClient.connect('test-server');

      expect(childProcess.spawn).toHaveBeenCalledWith('test-cmd', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const server = mcpClient.getServerStatus('test-server');
      expect(server?.status).toBe('connected');
      expect(server?.tools.length).toBe(1);
      expect(server?.tools[0].name).toBe('test_tool');
    });

    it('should throw error for disabled server', async () => {
      const testConfig = `version: "1.0"
servers:
  - id: disabled-server
    name: "Disabled"
    type: stdio
    command: "test"
    enabled: false
`;
      const tmpDir = join(process.cwd(), '.test-mcp-disabled');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();

      await expect(mcpClient.connect('disabled-server')).rejects.toThrow('Server disabled');

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });

    it('should handle connection timeout', async () => {
      const testConfig = `version: "1.0"
servers:
  - id: timeout-server
    name: "Timeout Test"
    type: stdio
    command: "test-cmd"
    enabled: true
    timeout: 100
`;
      const tmpDir = join(process.cwd(), '.test-mcp-timeout');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();

      // Override stdin.write to NOT respond (timeout)
      mockProcess.stdin.write = vi.fn();

      // Don't emit any responses - let it timeout
      await expect(mcpClient.connect('timeout-server')).rejects.toThrow('timeout');

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    }, 10000);

    it('should throw error for nonexistent server', async () => {
      await expect(mcpClient.connect('nonexistent')).rejects.toThrow('Server not found');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const testConfig = `version: "1.0"
servers:
  - id: test-server
    name: "Test"
    type: stdio
    command: "test-cmd"
    enabled: true
    timeout: 3000
`;
      const tmpDir = join(process.cwd(), '.test-mcp-disconnect');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();
    });

    afterEach(async () => {
      await fs.rm(join(process.cwd(), '.test-mcp-disconnect'), { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });

    it('should kill process and update status', async () => {
      // Connect first (mock responses already set up in beforeEach)
      await mcpClient.connect('test-server');
      expect(mcpClient.getServerStatus('test-server')?.status).toBe('connected');

      // Disconnect
      await mcpClient.disconnect('test-server');

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(mcpClient.getServerStatus('test-server')?.status).toBe('disconnected');
      expect(mcpClient.getServerStatus('test-server')?.tools.length).toBe(0);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(mcpClient.disconnect('test-server')).resolves.not.toThrow();
    });
  });

  describe('listTools', () => {
    beforeEach(async () => {
      const testConfig = `version: "1.0"
servers:
  - id: test-server
    name: "Test"
    type: stdio
    command: "test-cmd"
    enabled: true
    timeout: 3000
`;
      const tmpDir = join(process.cwd(), '.test-mcp-listtools');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();
    });

    afterEach(async () => {
      await fs.rm(join(process.cwd(), '.test-mcp-listtools'), { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });

    it('should return cached tools from connected server', async () => {
      // Override to return specific tools
      mockProcess.stdin.write = vi.fn((data: string) => {
        const msg = JSON.parse(data.trim());
        setImmediate(() => {
          if (msg.method === 'initialize') {
            mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
          } else if (msg.method === 'tools/list') {
            mockProcess.stdout.emit(
              'data',
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  tools: [
                    { name: 'tool1', description: 'First', inputSchema: { type: 'object', properties: {} } },
                    { name: 'tool2', description: 'Second', inputSchema: { type: 'object', properties: {} } },
                  ],
                },
              }) + '\n'
            );
          }
        });
      });

      await mcpClient.connect('test-server');
      const tools = await mcpClient.listTools('test-server');

      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    it('should throw error if server not connected', async () => {
      await expect(mcpClient.listTools('test-server')).rejects.toThrow('not connected');
    });

    it('should throw error for nonexistent server', async () => {
      await expect(mcpClient.listTools('nonexistent')).rejects.toThrow('Server not found');
    });
  });

  describe('invokeTool', () => {
    beforeEach(async () => {
      const testConfig = `version: "1.0"
servers:
  - id: test-server
    name: "Test"
    type: stdio
    command: "test-cmd"
    enabled: true
    timeout: 3000
`;
      const tmpDir = join(process.cwd(), '.test-mcp-invoke');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();
    });

    afterEach(async () => {
      await fs.rm(join(process.cwd(), '.test-mcp-invoke'), { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });

    it('should send tool call and return result', async () => {
      // Override to handle tool calls
      mockProcess.stdin.write = vi.fn((data: string) => {
        const msg = JSON.parse(data.trim());
        setImmediate(() => {
          if (msg.method === 'initialize') {
            mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
          } else if (msg.method === 'tools/list') {
            mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } }) + '\n');
          } else if (msg.method === 'tools/call') {
            mockProcess.stdout.emit(
              'data',
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  content: [{ type: 'text', text: 'Tool executed successfully' }],
                },
              }) + '\n'
            );
          }
        });
      });

      await mcpClient.connect('test-server');

      const result = await mcpClient.invokeTool({
        serverId: 'test-server',
        toolName: 'test_tool',
        parameters: { arg1: 'value1' },
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle tool execution error', async () => {
      // Override to return errors for tool calls
      mockProcess.stdin.write = vi.fn((data: string) => {
        const msg = JSON.parse(data.trim());
        setImmediate(() => {
          if (msg.method === 'initialize') {
            mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }) + '\n');
          } else if (msg.method === 'tools/list') {
            mockProcess.stdout.emit('data', JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } }) + '\n');
          } else if (msg.method === 'tools/call') {
            mockProcess.stdout.emit(
              'data',
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32000, message: 'Tool execution failed' },
              }) + '\n'
            );
          }
        });
      });

      await mcpClient.connect('test-server');

      const result = await mcpClient.invokeTool({
        serverId: 'test-server',
        toolName: 'failing_tool',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
    });

    it('should return error if server not connected', async () => {
      const result = await mcpClient.invokeTool({
        serverId: 'test-server',
        toolName: 'test_tool',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });

    it('should return error for nonexistent server', async () => {
      const result = await mcpClient.invokeTool({
        serverId: 'nonexistent',
        toolName: 'test_tool',
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('listServers', () => {
    it('should return all configured servers', async () => {
      const testConfig = `version: "1.0"
servers:
  - id: server1
    name: "Server 1"
    type: stdio
    command: "cmd1"
    enabled: true
  - id: server2
    name: "Server 2"
    type: stdio
    command: "cmd2"
    enabled: false
`;
      const tmpDir = join(process.cwd(), '.test-mcp-list');
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.mkdir(join(tmpDir, 'settings'), { recursive: true });
      await fs.writeFile(join(tmpDir, 'settings', 'mcp-servers.yaml'), testConfig);

      process.env.REPO_ROOT = tmpDir;
      await mcpClient.loadConfig();

      const servers = mcpClient.listServers();
      expect(servers.length).toBe(2);
      expect(servers.map((s) => s.id)).toContain('server1');
      expect(servers.map((s) => s.id)).toContain('server2');

      // Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });
      delete process.env.REPO_ROOT;
    });
  });
});
