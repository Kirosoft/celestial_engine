import type { NextApiRequest, NextApiResponse } from 'next';
import { mcpClient } from '../../../../../lib/mcpClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id: serverId } = req.query;
  
  if (!serverId || typeof serverId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'serverId is required'
    });
  }
  
  if (req.method === 'GET') {
    try {
      // Load config if not already loaded
      await mcpClient.loadConfig();
      
      // Check if server is connected
      const servers = mcpClient.listServers();
      const server = servers.find(s => s.id === serverId);
      
      if (!server) {
        return res.status(404).json({
          success: false,
          error: `Server ${serverId} not found`
        });
      }
      
      if (server.status !== 'connected') {
        return res.status(400).json({
          success: false,
          error: `Server ${serverId} is not connected (status: ${server.status})`
        });
      }
      
      // Get tools for the server
      const tools = await mcpClient.listTools(serverId);
      
      return res.status(200).json({
        success: true,
        serverId,
        tools: tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }))
      });
    } catch (error: any) {
      console.error(`[api/mcp/servers/${serverId}/tools] Error listing tools:`, error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to list tools'
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }
}
