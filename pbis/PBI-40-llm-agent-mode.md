# PBI-40: LLM Agent Mode with Tool Calling

**Status:** ✅ COMPLETE  
**Dependencies:** PBI-38 (MCP Client Foundation), PBI-39 (MCP Tool Node Type)  
**Test Coverage:** 5 unit tests, 178 total passing

## Overview

Implements autonomous tool calling for LLM nodes based on graph topology. When MCPTool nodes have edges pointing to an LLM node, those tools become available for the LLM to invoke autonomously during conversation.

This completes the MCP integration story:
- **PBI-38:** Infrastructure (MCP client)
- **PBI-39:** Explicit tool nodes (user-controlled invocation)
- **PBI-40:** Autonomous agents (LLM-controlled, graph-discovered)

## Architecture

### Graph-Based Discovery
Tools are discovered from graph topology rather than hidden configuration:
```
MCPTool Node ──edge──> LLM Node
```

When an MCPTool node has an outgoing edge to an LLM node, that tool becomes available for the LLM to use. This makes tool availability **visually explicit** in the graph.

### Multi-Turn Conversation Flow
```
1. User Query → LLM
2. LLM analyzes query, decides to use tool
3. LLM responds: {"tool_call": {"tool": "filesystem_read_file", "parameters": {"path": "/etc/hosts"}}}
4. System detects tool call, executes via mcpClient
5. Tool returns result
6. System makes follow-up LLM call with: "System: ... User: ... Tool Result: ... Provide your final answer"
7. LLM processes result and provides final answer to user
```

### Tool Call Format
LLMs respond with JSON when they want to invoke a tool:
```json
{"tool_call": {"tool": "server_toolname", "parameters": {...}}}
```

The system:
1. Parses JSON from LLM response
2. Looks up tool from discovered tools
3. Executes tool via `mcpClient.invokeTool()`
4. Makes follow-up LLM call with result
5. Returns final LLM answer

## Implementation

### Tool Discovery (lib/execution.ts lines ~170-200)
At LLM executor start:
1. Scan all nodes in graph
2. Find MCPTool nodes with edges pointing to current LLM
3. Build `availableTools` array with metadata:
   - `name`: Combined server_toolname format
   - `description`: For prompt injection
   - `parameters`: Tool input schema
   - `nodeId`, `serverId`, `toolName`: For execution

Emits diagnostic: `discovered_tools` with count and tool names

### Tool Injection (lib/execution.ts lines ~360-388)
For Ollama provider (prompt-based models):
1. If tools available, append to system prompt:
   ```
   You have access to the following tools:
   - filesystem_read_file: Read contents of a file
   
   To use a tool, respond with JSON:
   {"tool_call": {"tool": "tool_name", "parameters": {...}}}
   ```
2. Includes usage instructions and format

Emits diagnostic: `tool_instructions_injected` with tool count

### Tool Call Detection & Execution (lib/execution.ts lines ~407-480)
After receiving LLM response:
1. **Detection:** Regex match for `{"tool_call":{...}}` pattern
2. **Parsing:** Extract tool name and parameters from JSON
3. **Lookup:** Find matching tool from availableTools
4. **Validation:** Check tool exists and is connected
5. **Execution:** Call `mcpClient.invokeTool()` with merged parameters
6. **Result Formatting:** Convert to text (string or JSON.stringify)
7. **Follow-up:** Make new LLM call with tool result
8. **Return:** Final LLM answer as output

### Error Handling
- **Tool not found:** Returns error output, emits `tool_not_found` diagnostic
- **Parse error:** Returns error output, emits `tool_call_parse_error` diagnostic
- **Execution error:** Returns error output, emits `tool_execution_failed` diagnostic
- **Success:** Emits `tool_call_detected`, `tool_executed`, `tool_result_processed`

### Parameter Merging
Tool parameters are merged from two sources:
1. MCPTool node `parameters` prop (node configuration)
2. JSON `parameters` field in tool call (LLM-provided)

LLM parameters override node parameters (LLM has higher priority).

## Diagnostics

Tool calling emits structured diagnostics for debugging:

- `discovered_tools` (info): Tool discovery at executor start
  - `count`: Number of tools found
  - `tools`: Array of tool names

- `tool_instructions_injected` (info): Tool instructions added to prompt
  - `toolCount`: Number of tools in instructions

- `tool_call_detected` (info): LLM requested tool invocation
  - `tool`: Tool name requested
  - `parameters`: Parameters from LLM

- `tool_executed` (info): Tool invoked successfully
  - `tool`: Tool name
  - `duration`: Execution time in ms
  - `resultLength`: Size of result

- `tool_result_processed` (info): Follow-up LLM call completed
  - `responseLength`: Length of final answer

- `tool_not_found` (error): LLM requested unknown tool
  - `requestedTool`: Tool name that wasn't found

- `tool_execution_failed` (error): Tool invocation failed
  - `error`: Error message from mcpClient

- `tool_call_parse_error` (error): Invalid JSON in tool call
  - `error`: Parse error message

## Testing

### Unit Tests (test/llmToolCalling.test.ts)
5 tests covering tool calling flow:

1. **Tool Discovery:** Verifies MCPTool nodes with edges are discovered
2. **Tool Injection:** Verifies tool instructions added to prompt (Ollama)
3. **Tool Execution:** Verifies tool call detection and execution
4. **No Tools:** Verifies no injection when no tools connected
5. **Multiple Tools:** Verifies multiple connected tools discovered

All tests use mocked `nodeRepo.listNodes()` and `mcpClient.invokeTool()`.

### Test Results
- 5 new tool calling tests passing
- 173 existing tests still passing
- **Total: 178/178 tests passing**

## Files Changed

### Modified
- `lib/execution.ts`: Added tool discovery, injection, and calling (~100 lines)
  - Tool discovery in LLM executor start
  - Tool injection into system prompt (Ollama)
  - Tool call detection via regex
  - Tool execution via mcpClient
  - Follow-up LLM call with result
  - Comprehensive error handling

### Created
- `test/llmToolCalling.test.ts`: 5 unit tests for tool calling

## Usage Example

1. **Create MCPTool node:**
   - Type: MCPTool
   - serverId: "filesystem"
   - toolName: "read_file"
   - parameters: {} (optional defaults)

2. **Create LLM node:**
   - Type: LLM
   - model: "llama2" (or any Ollama model)
   - system: "You are a helpful assistant"

3. **Connect:** Draw edge from MCPTool → LLM

4. **Execute LLM node** with user query like "Read the contents of /etc/hosts"

5. **Flow:**
   - LLM receives query + tool descriptions
   - LLM decides to use filesystem_read_file
   - System executes tool
   - LLM receives result
   - LLM provides final answer

## Design Decisions

### Why Graph-Based Discovery?
- **Explicit:** Tool availability is visually clear in the graph
- **No Hidden Config:** No invisible settings or magic strings
- **Flexible:** Easy to add/remove tools by editing edges
- **Auditable:** Can see exactly what tools an LLM can access

### Why JSON Tool Call Format?
- **Simple:** Easy to parse with regex
- **Model-Agnostic:** Works with any LLM that can generate JSON
- **Debuggable:** Tool calls visible in diagnostics and logs
- **Extensible:** Can add metadata fields later

### Why Follow-Up LLM Call?
- **Reasoning:** LLM can interpret tool results and provide context
- **Natural:** More conversational than raw tool output
- **Error Handling:** LLM can explain errors in user-friendly way
- **Multi-Step:** Enables chains of tool calls (future work)

### Why Ollama Only?
Current implementation injects tools into system prompt, which works best with prompt-based models (Ollama). OpenAI API has native function calling that should be used instead. Future work will add OpenAI function calling support.

## Future Enhancements

1. **Multi-Turn Tool Loops:** Allow LLM to call multiple tools in sequence before final answer
2. **OpenAI Function Calling:** Use native OpenAI API for better tool integration
3. **Tool Schema Discovery:** Automatically fetch tool schemas from MCP servers
4. **Custom Inspector:** Visual tool parameter editor like FileReaderNodeInspector
5. **Tool Call History:** Track tool usage across conversation for debugging
6. **Parallel Tool Calls:** Execute multiple tools simultaneously when independent
7. **Tool Permissions:** Fine-grained control over which tools LLM can access
8. **Tool Rate Limiting:** Prevent infinite tool calling loops

## Commit

**Hash:** e89403a  
**Message:** feat: PBI-40 LLM Agent Mode - graph-based tool discovery and autonomous tool calling  
**Date:** 2025-01-20

## Related PBIs

- **PBI-38:** MCP Client Foundation (dependency)
- **PBI-39:** MCP Tool Node Type (dependency)
- **PBI-41:** (Future) OpenAI Function Calling Support
- **PBI-42:** (Future) Multi-Turn Tool Calling Loops
