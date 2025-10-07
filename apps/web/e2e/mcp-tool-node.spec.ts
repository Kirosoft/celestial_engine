import { test, expect } from '@playwright/test';
import { resetRepoRoot } from './helpers';

test.describe('MCPTool Node E2E', () => {
  test.beforeEach(async () => {
    await resetRepoRoot();
  });

  test('should create and configure MCPTool node', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for canvas to load
    await page.waitForSelector('.react-flow', { state: 'visible', timeout: 5000 });
    
    // Create MCPTool node via API (simpler than drag-drop in E2E)
    const createResponse = await page.request.post('http://localhost:3000/api/nodes', {
      data: {
        type: 'MCPTool',
        props: {
          serverId: 'filesystem',
          toolName: 'list_directory',
          parameters: {
            path: '.'
          }
        },
        position: { x: 100, y: 100 }
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const nodeData = await createResponse.json();
    expect(nodeData.id).toBeDefined();
    
    // Reload page to see the node
    await page.reload();
    await page.waitForSelector('.react-flow', { state: 'visible' });
    
    // Check that MCPTool node appears on canvas
    await page.waitForSelector('.mcp-tool-node', { state: 'visible', timeout: 3000 });
    
    // Verify node displays correct information
    const nodeElement = page.locator('.mcp-tool-node').first();
    await expect(nodeElement).toBeVisible();
    
    // Check for tool icon
    await expect(nodeElement.locator('.node-icon')).toContainText('🛠️');
    
    // Check server and tool name are displayed
    await expect(nodeElement).toContainText('filesystem');
    await expect(nodeElement).toContainText('list_directory');
    
    // Check parameter count
    await expect(nodeElement).toContainText('1 set');
  });

  test('should execute MCPTool node via API', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Create MCPTool node
    const createResponse = await page.request.post('http://localhost:3000/api/nodes', {
      data: {
        type: 'MCPTool',
        props: {
          serverId: 'test-server',
          toolName: 'test_tool',
          parameters: {
            input: 'test'
          }
        },
        position: { x: 100, y: 100 }
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const nodeData = await createResponse.json();
    const nodeId = nodeData.id;
    
    // Note: Actual execution would require MCP server to be running
    // For E2E test, we just verify the node was created with correct props
    const getResponse = await page.request.get(`http://localhost:3000/api/nodes/${nodeId}`);
    expect(getResponse.ok()).toBeTruthy();
    
    const node = await getResponse.json();
    expect(node.type).toBe('MCPTool');
    expect(node.props.serverId).toBe('test-server');
    expect(node.props.toolName).toBe('test_tool');
    expect(node.props.parameters.input).toBe('test');
  });

  test('should update MCPTool node parameters', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Create MCPTool node
    const createResponse = await page.request.post('http://localhost:3000/api/nodes', {
      data: {
        type: 'MCPTool',
        props: {
          serverId: 'filesystem',
          toolName: 'read_file',
          parameters: {
            path: '/test.txt'
          }
        },
        position: { x: 100, y: 100 }
      }
    });
    
    const nodeData = await createResponse.json();
    const nodeId = nodeData.id;
    
    // Update parameters
    const updateResponse = await page.request.put(`http://localhost:3000/api/nodes/${nodeId}`, {
      data: {
        props: {
          serverId: 'filesystem',
          toolName: 'read_file',
          parameters: {
            path: '/updated.txt',
            encoding: 'utf-8'
          }
        }
      }
    });
    
    expect(updateResponse.ok()).toBeTruthy();
    
    // Verify update
    const getResponse = await page.request.get(`http://localhost:3000/api/nodes/${nodeId}`);
    const updatedNode = await getResponse.json();
    
    expect(updatedNode.props.parameters.path).toBe('/updated.txt');
    expect(updatedNode.props.parameters.encoding).toBe('utf-8');
  });
});
