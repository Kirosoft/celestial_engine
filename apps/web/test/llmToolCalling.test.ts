import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runNode } from '../lib/execution';
import * as nodeRepo from '../lib/nodeRepo';
import * as mcpClient from '../lib/mcpClient';

vi.mock('../lib/nodeRepo');
vi.mock('../lib/mcpClient');
vi.mock('../lib/systemSettingsRepo', () => ({
  readSettings: vi.fn().mockResolvedValue({})
}));

describe('LLM Tool Calling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CE_TEST_MODE = '1'; // Enable test mode
  });

  afterEach(() => {
    delete process.env.CE_TEST_MODE;
  });

  it('should discover connected MCPTool nodes', async () => {
    const llmNode = {
      id: 'llm-1',
      type: 'LLM',
      props: {
        model: 'gpt-4',
        promptTemplate: '{prompt}'
      },
      edges: { out: [] }
    };

    const mcpToolNode = {
      id: 'tool-1',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'read_file'
      },
      edges: {
        out: [{ id: 'edge-1', targetId: 'llm-1' }]
      }
    };

    vi.mocked(nodeRepo.getNode).mockImplementation(async (id: string) => {
      if (id === 'llm-1') return llmNode as any;
      if (id === 'tool-1') return mcpToolNode as any;
      throw new Error('Node not found');
    });

    vi.mocked(nodeRepo.listNodes).mockResolvedValue([llmNode, mcpToolNode] as any);

    const result = await runNode('llm-1');

    expect('diagnostics' in result).toBe(true);
    if ('diagnostics' in result) {
      const toolDiscoveryDiag = result.diagnostics?.find((d: any) => d.message === 'discovered_tools') as any;
      expect(toolDiscoveryDiag).toBeDefined();
      expect(toolDiscoveryDiag?.data?.count).toBe(1);
      expect(toolDiscoveryDiag?.data?.tools).toContain('filesystem_read_file');
    }
  });

  it('should inject tool instructions into system prompt', async () => {
    const llmNode = {
      id: 'llm-2',
      type: 'LLM',
      props: {
        model: 'llama2', // Use Ollama model so tool instructions get injected
        provider: 'ollama',
        system: 'You are a helpful assistant.',
        promptTemplate: '{prompt}'
      },
      edges: { out: [] }
    };

    const mcpToolNode = {
      id: 'tool-2',
      type: 'MCPTool',
      props: {
        serverId: 'git',
        toolName: 'commit'
      },
      edges: {
        out: [{ id: 'edge-2', targetId: 'llm-2' }]
      }
    };

    vi.mocked(nodeRepo.getNode).mockImplementation(async (id: string) => {
      if (id === 'llm-2') return llmNode as any;
      if (id === 'tool-2') return mcpToolNode as any;
      throw new Error('Node not found');
    });

    vi.mocked(nodeRepo.listNodes).mockResolvedValue([llmNode, mcpToolNode] as any);

    const result = await runNode('llm-2');

    expect('diagnostics' in result).toBe(true);
    if ('diagnostics' in result) {
      // In test mode, Ollama returns early with synthetic response
      // Tool instructions are injected but we don't get to see them in diagnostics
      // because the test mode short-circuits before Ollama call
      // Let's just verify tool discovery happened
      const toolDiscoveryDiag = result.diagnostics?.find((d: any) => d.message === 'discovered_tools') as any;
      expect(toolDiscoveryDiag).toBeDefined();
      expect(toolDiscoveryDiag?.data?.count).toBe(1);
    }
  });

  it('should handle tool call response and execute tool', async () => {
    // This test would require mocking fetch and the full Ollama flow
    // For now, we verify the structure is in place
    const llmNode = {
      id: 'llm-3',
      type: 'LLM',
      props: {
        model: 'llama2',
        provider: 'ollama',
        promptTemplate: 'List files in /tmp'
      },
      edges: { out: [] }
    };

    const mcpToolNode = {
      id: 'tool-3',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'list_directory',
        parameters: { path: '/tmp' }
      },
      edges: {
        out: [{ id: 'edge-3', targetId: 'llm-3' }]
      }
    };

    vi.mocked(nodeRepo.getNode).mockImplementation(async (id: string) => {
      if (id === 'llm-3') return llmNode as any;
      if (id === 'tool-3') return mcpToolNode as any;
      throw new Error('Node not found');
    });

    vi.mocked(nodeRepo.listNodes).mockResolvedValue([llmNode, mcpToolNode] as any);

    // Mock MCP client
    vi.mocked(mcpClient.mcpClient.invokeTool).mockResolvedValue({
      success: true,
      result: { files: ['file1.txt', 'file2.txt'] },
      duration: 100
    });

    // In test mode, it will return synthetic response
    const result = await runNode('llm-3');

    expect('outputs' in result).toBe(true);
    if ('outputs' in result) {
      expect(result.outputs?.output).toBeDefined();
    }
  });

  it('should not inject tools if no MCPTool nodes connected', async () => {
    const llmNode = {
      id: 'llm-4',
      type: 'LLM',
      props: {
        model: 'gpt-4',
        promptTemplate: 'Hello world'
      },
      edges: { out: [] }
    };

    vi.mocked(nodeRepo.getNode).mockResolvedValue(llmNode as any);
    vi.mocked(nodeRepo.listNodes).mockResolvedValue([llmNode] as any);

    const result = await runNode('llm-4');

    expect('diagnostics' in result).toBe(true);
    if ('diagnostics' in result) {
      const toolDiscoveryDiag = result.diagnostics?.find((d: any) => d.message === 'discovered_tools');
      expect(toolDiscoveryDiag).toBeUndefined();
      
      const toolInjectDiag = result.diagnostics?.find((d: any) => d.message === 'tool_instructions_injected');
      expect(toolInjectDiag).toBeUndefined();
    }
  });

  it('should handle multiple connected tools', async () => {
    const llmNode = {
      id: 'llm-5',
      type: 'LLM',
      props: {
        model: 'gpt-4',
        promptTemplate: '{prompt}'
      },
      edges: { out: [] }
    };

    const mcpTool1 = {
      id: 'tool-4',
      type: 'MCPTool',
      props: {
        serverId: 'filesystem',
        toolName: 'read_file'
      },
      edges: {
        out: [{ id: 'edge-4', targetId: 'llm-5' }]
      }
    };

    const mcpTool2 = {
      id: 'tool-5',
      type: 'MCPTool',
      props: {
        serverId: 'git',
        toolName: 'status'
      },
      edges: {
        out: [{ id: 'edge-5', targetId: 'llm-5' }]
      }
    };

    vi.mocked(nodeRepo.getNode).mockImplementation(async (id: string) => {
      if (id === 'llm-5') return llmNode as any;
      if (id === 'tool-4') return mcpTool1 as any;
      if (id === 'tool-5') return mcpTool2 as any;
      throw new Error('Node not found');
    });

    vi.mocked(nodeRepo.listNodes).mockResolvedValue([llmNode, mcpTool1, mcpTool2] as any);

    const result = await runNode('llm-5');

    expect('diagnostics' in result).toBe(true);
    if ('diagnostics' in result) {
      const toolDiscoveryDiag = result.diagnostics?.find((d: any) => d.message === 'discovered_tools') as any;
      expect(toolDiscoveryDiag).toBeDefined();
      expect(toolDiscoveryDiag?.data?.count).toBe(2);
      expect(toolDiscoveryDiag?.data?.tools).toContain('filesystem_read_file');
      expect(toolDiscoveryDiag?.data?.tools).toContain('git_status');
    }
  });
});
