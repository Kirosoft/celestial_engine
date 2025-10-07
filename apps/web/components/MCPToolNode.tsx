import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

interface MCPToolNodeProps {
  data: any;
  selected?: boolean;
}

export const MCPToolNode = memo<MCPToolNodeProps>(({ data, selected }) => {
  const { serverId, toolName, parameters } = data?.rawProps || {};
  const paramCount = parameters ? Object.keys(parameters).length : 0;
  
  return (
    <div 
      className={`mcp-tool-node ${selected ? 'selected' : ''}`}
      style={{
        padding: '12px',
        borderRadius: '8px',
        border: selected ? '2px solid #3b82f6' : '2px solid #6b7280',
        backgroundColor: '#1f2937',
        color: '#f9fafb',
        minWidth: '180px',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left}
        style={{ background: '#6b7280' }}
      />
      
      <div 
        className="node-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          fontWeight: 600,
          fontSize: '14px'
        }}
      >
        <span className="node-icon" style={{ fontSize: '18px' }}>🛠️</span>
        <span className="node-title">MCP Tool</span>
      </div>
      
      <div 
        className="node-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '12px'
        }}
      >
        <div className="field">
          <label style={{ color: '#9ca3af', marginRight: '4px' }}>Server:</label>
          <span className="value" style={{ color: '#f9fafb' }}>
            {serverId || <em style={{ color: '#6b7280' }}>Not set</em>}
          </span>
        </div>
        
        <div className="field">
          <label style={{ color: '#9ca3af', marginRight: '4px' }}>Tool:</label>
          <span className="value" style={{ color: '#f9fafb' }}>
            {toolName || <em style={{ color: '#6b7280' }}>Not set</em>}
          </span>
        </div>
        
        {paramCount > 0 && (
          <div className="field">
            <label style={{ color: '#9ca3af', marginRight: '4px' }}>Parameters:</label>
            <span className="value" style={{ color: '#10b981' }}>
              {paramCount} set
            </span>
          </div>
        )}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        id="result"
        style={{ background: '#10b981' }}
      />
    </div>
  );
});

MCPToolNode.displayName = 'MCPToolNode';
