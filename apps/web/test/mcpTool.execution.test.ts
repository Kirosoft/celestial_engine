import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runNode, registerExecutor, getExecutor } from '../lib/execution';
import * as mcpClientModule from '../lib/mcpClient';

// Mock the mcpClient module
vi.mock('../lib/mcpClient', () => ({
  mcpClient: {
    invokeTool: vi.fn(),
    listTools: vi.fn(),
    listServers: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    loadConfig: vi.fn()
  }
}));

// Mock node repo
vi.mock('../lib/nodeRepo', () => ({
  getNode: vi.fn((id: string) => Promise.resolve({
    id,
    type: 'MCPTool',
    props: {}
  })),
  updateNode: vi.fn(),
  listNodes: vi.fn(() => Promise.resolve([]))
}));

describe('MCPTool Node Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should invoke tool with explicit parameters', async () => {
    const mockResult = {
      success: true,
      result: { files: ['file1.txt', 'file2.txt'] },
      duration: 123
    };

    vi.mocked(mcpClientModule.mcpClient.invokeTool).mockResolvedValue(mockResult);

    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-1',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'list_directory',
        parameters: { path: '/test' }
      }
    } as any);

    const result = await runNode('mcp-1');

    expect(mcpClientModule.mcpClient.invokeTool).toHaveBeenCalledWith({
      serverId: 'filesystem',
      toolName: 'list_directory',
      parameters: { path: '/test' }
    });

    expect(result).toMatchObject({
      runId: expect.any(String),
      emissions: expect.arrayContaining([
        expect.objectContaining({
          port: 'result',
          value: mockResult.result
        })
      ])
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'info',
          message: 'MCP tool call started'
        }),
        expect.objectContaining({
          level: 'info',
          message: 'MCP tool call succeeded'
        })
      ])
    );
  });

  it('should merge input edge data with explicit parameters', async () => {
    const mockResult = {
      success: true,
      result: { content: 'file contents' },
      duration: 100
    };

    vi.mocked(mcpClientModule.mcpClient.invokeTool).mockResolvedValue(mockResult);

    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-2',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'read_file',
        parameters: { encoding: 'utf-8' }
      }
    } as any);

    // Simulate input edge data
    const { appendInput } = await import('../lib/execution');
    appendInput('mcp-2', 'path', '/dynamic/path.txt', {
      edgeId: 'edge-1',
      sourceNodeId: 'source-1'
    });

    const result = await runNode('mcp-2');

    // Input edge data should override explicit parameters
    expect(mcpClientModule.mcpClient.invokeTool).toHaveBeenCalledWith({
      serverId: 'filesystem',
      toolName: 'read_file',
      parameters: {
        encoding: 'utf-8',
        path: '/dynamic/path.txt' // From input edge
      }
    });

    expect(result).toMatchObject({
      emissions: expect.arrayContaining([
        expect.objectContaining({
          port: 'result',
          value: mockResult.result
        })
      ])
    });
  });

  it('should handle tool execution errors', async () => {
    const mockResult = {
      success: false,
      error: 'File not found',
      duration: 50
    };

    vi.mocked(mcpClientModule.mcpClient.invokeTool).mockResolvedValue(mockResult);

    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-3',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'read_file',
        parameters: { path: '/missing.txt' }
      }
    } as any);

    const result = await runNode('mcp-3');

    expect(result).toMatchObject({
      error: 'File not found',
      emissions: expect.arrayContaining([
        expect.objectContaining({
          port: 'error',
          value: 'File not found'
        })
      ])
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          message: 'MCP tool call failed'
        })
      ])
    );
  });

  it('should handle connection errors', async () => {
    vi.mocked(mcpClientModule.mcpClient.invokeTool).mockRejectedValue(
      new Error('Server not connected')
    );

    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-4',
      type: 'MCPTool',
      props: {
        serverId: 'nonexistent',
        toolName: 'some_tool',
        parameters: {}
      }
    } as any);

    const result = await runNode('mcp-4');

    expect(result).toMatchObject({
      error: 'Server not connected',
      emissions: expect.arrayContaining([
        expect.objectContaining({
          port: 'error',
          value: 'Server not connected'
        })
      ])
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          message: 'MCP tool invocation error'
        })
      ])
    );
  });

  it('should return error if serverId or toolName is missing', async () => {
    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-5',
      type: 'MCPTool',
      props: {
        // Missing serverId and toolName
        parameters: { path: '/test' }
      }
    } as any);

    const result = await runNode('mcp-5');

    expect(result).toMatchObject({
      error: 'Missing required fields: serverId and toolName are required'
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          message: 'serverId and toolName must be specified'
        })
      ])
    );

    // Should not attempt to invoke tool
    expect(mcpClientModule.mcpClient.invokeTool).not.toHaveBeenCalled();
  });

  it('should use default timeout if not specified', async () => {
    const mockResult = {
      success: true,
      result: { data: 'test' },
      duration: 50
    };

    vi.mocked(mcpClientModule.mcpClient.invokeTool).mockResolvedValue(mockResult);

    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-6',
      type: 'MCPTool',
      props: {
        serverId: 'test-server',
        toolName: 'test_tool',
        // timeout not specified, should default to 30000
        parameters: {}
      }
    } as any);

    const result = await runNode('mcp-6');

    expect(result.error).toBeUndefined();
    expect(mcpClientModule.mcpClient.invokeTool).toHaveBeenCalled();
  });

  it('should include tool result in emissions', async () => {
    const complexResult = {
      success: true,
      result: {
        files: ['a.txt', 'b.txt'],
        directories: ['dir1', 'dir2'],
        total: 4
      },
      duration: 250
    };

    vi.mocked(mcpClientModule.mcpClient.invokeTool).mockResolvedValue(complexResult);

    const nodeRepoModule = await import('../lib/nodeRepo');
    vi.mocked(nodeRepoModule.getNode).mockResolvedValue({
      id: 'mcp-7',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'list_all',
        parameters: { path: '/' }
      }
    } as any);

    const result = await runNode('mcp-7');

    expect('emissions' in result).toBe(true);
    if ('emissions' in result) {
      expect(result.emissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            port: 'result',
            value: complexResult.result
          })
        ])
      );
    }
  });
});
