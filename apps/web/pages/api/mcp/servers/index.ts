import type { NextApiRequest, NextApiResponse } from 'next';
import { mcpClient, MCPServer } from '../../../../lib/mcpClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Load config if not already loaded
      await mcpClient.loadConfig();
      
      // Get all configured servers with their status
      const servers = mcpClient.listServers();
      
      return res.status(200).json({
        success: true,
        servers: servers.map((s: MCPServer) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          status: s.status,
          enabled: s.enabled,
          toolCount: s.tools?.length || 0
        }))
      });
    } catch (error: any) {
      console.error('[api/mcp/servers] Error listing servers:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list MCP servers'
      });
    }
  } else if (req.method === 'POST') {
    // Connect to a server
    const { serverId } = req.body;
    
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'serverId is required'
      });
    }
    
    try {
      await mcpClient.connect(serverId);
      const servers = mcpClient.listServers();
      const server = servers.find((s: MCPServer) => s.id === serverId);
      
      return res.status(200).json({
        success: true,
        server: {
          id: server?.id,
          name: server?.name,
          status: server?.status,
          toolCount: server?.tools?.length || 0
        }
      });
    } catch (error: any) {
      console.error('[api/mcp/servers] Error connecting to server:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect to MCP server'
      });
    }
  } else if (req.method === 'DELETE') {
    // Disconnect from a server
    const { serverId } = req.body;
    
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'serverId is required'
      });
    }
    
    try {
      await mcpClient.disconnect(serverId);
      
      return res.status(200).json({
        success: true,
        message: `Disconnected from ${serverId}`
      });
    } catch (error: any) {
      console.error('[api/mcp/servers] Error disconnecting from server:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to disconnect from MCP server'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }
}
