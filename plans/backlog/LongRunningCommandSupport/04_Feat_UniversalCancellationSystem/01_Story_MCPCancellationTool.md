# Story: MCP Cancellation Tool

## Story Overview
**Story ID:** 01_Story_MCPCancellationTool
**Feature:** 04_Feat_UniversalCancellationSystem
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified "ssh_cancel_command MCP tool"]

As an MCP client managing background tasks
I want to cancel running commands using ssh_cancel_command
So that I can terminate unwanted tasks and clear session queues

## Problem Context
[Conversation Reference: User's requirement for MCP-based command cancellation]

MCP clients need programmatic control over background task cancellation to manage long-running commands and clear session queues when tasks are no longer needed.

## Acceptance Criteria

### MCP Tool Implementation
[Conversation Reference: User specified "ssh_cancel_command MCP tool"]

```gherkin
Given the MCP server is running
When ssh_cancel_command tool is called with sessionName
Then the MCP tool is available and functional
And the tool accepts sessionName as required parameter
And proper MCP protocol responses are returned
```

### Command Cancellation
```gherkin
Given a background task is running in a session
When ssh_cancel_command is called with the sessionName
Then the running command is cancelled within 1 second
And the task state transitions to 'cancelled'
And cancellation confirmation is returned to MCP client
```

### Queue Clearing
[Conversation Reference: User specified "Cancel running command + clear entire queue (KISS approach)"]

```gherkin
Given a session has running command and queued commands
When ssh_cancel_command is called
Then the active command is cancelled
And the entire command queue is cleared
And no queued commands remain for execution
```

### Session Validation
```gherkin
Given an invalid or non-existent sessionName
When ssh_cancel_command is called
Then an appropriate error response is returned
And the error clearly indicates the session issue
And no system errors occur
```

## Technical Implementation

### MCP Tool Definition
[Conversation Reference: Based on user's ssh_cancel_command specification]

```typescript
const sshCancelCommandTool: Tool = {
  name: "ssh_cancel_command",
  description: "Cancel running command and clear queue in SSH session",
  inputSchema: {
    type: "object",
    properties: {
      sessionName: {
        type: "string",
        description: "Name of the SSH session to cancel command in"
      }
    },
    required: ["sessionName"]
  }
};
```

### Implementation Components
- **Tool Registration**: Register ssh_cancel_command with MCP server
- **Parameter Validation**: Validate sessionName parameter
- **Session Lookup**: Locate session and verify cancellation capability
- **Cancellation Processing**: Trigger unified cancellation processing

### Response Format
```typescript
interface CancellationResponse {
  success: boolean;
  sessionName: string;
  action: 'cancelled' | 'no_task' | 'error';
  message: string;
  cancelledTask?: {
    command: string;
    duration: number;
  };
  clearedQueue?: {
    queuedCommands: number;
  };
}
```

## Implementation Steps

1. **MCP Tool Registration**: Register ssh_cancel_command tool
2. **Parameter Processing**: Implement sessionName parameter handling
3. **Cancellation Integration**: Integrate with unified cancellation system
4. **Response Generation**: Implement cancellation response generation

## Testing Strategy

### Tool Functionality Testing
- **Tool Availability**: Verify MCP tool is properly registered
- **Parameter Handling**: Test sessionName parameter processing
- **Response Format**: Validate response format consistency

### Cancellation Testing
- **Active Command Cancellation**: Test cancellation of running commands
- **Queue Clearing**: Test complete queue clearing functionality
- **Error Handling**: Test error scenarios and edge cases

## Definition of Done

### Functional Requirements
- [ ] ssh_cancel_command MCP tool implemented and registered
- [ ] SessionName parameter validation and processing
- [ ] Command cancellation within 1 second of call
- [ ] Complete queue clearing on cancellation

### Technical Requirements
- [ ] MCP protocol compliance for tool implementation
- [ ] Integration with unified cancellation processing system
- [ ] Thread-safe cancellation operations
- [ ] Proper error handling for all scenarios

### Validation Requirements
- [ ] MCP tool accessible and functional from MCP clients
- [ ] Cancellation effectiveness verified within time limits
- [ ] Queue clearing confirmed for all scenarios
- [ ] Error handling tested for edge cases

## Integration Points

### Unified Cancellation System
[Conversation Reference: User's unified cancellation processing]

- **Cancellation Trigger**: Trigger unified cancellation processing
- **State Management**: Update task and session state appropriately
- **Queue Operations**: Clear session queue through unified system
- **Notification Coordination**: Coordinate notifications across interfaces

### Session Management Integration
- **Session Lookup**: Access session data by sessionName
- **Task Validation**: Verify active task exists for cancellation
- **State Updates**: Update session state after cancellation
- **Resource Cleanup**: Coordinate resource cleanup with session management

## Response Examples

### Successful Cancellation
```json
{
  "success": true,
  "sessionName": "user-session-123",
  "action": "cancelled",
  "message": "Command cancelled and queue cleared",
  "cancelledTask": {
    "command": "find /var/log -name '*.log' | xargs grep ERROR",
    "duration": 45000
  },
  "clearedQueue": {
    "queuedCommands": 2
  }
}
```

### No Task to Cancel
```json
{
  "success": true,
  "sessionName": "user-session-123",
  "action": "no_task",
  "message": "No active task to cancel in session"
}
```

### Session Not Found
```json
{
  "success": false,
  "sessionName": "invalid-session",
  "action": "error",
  "message": "SSH session 'invalid-session' not found"
}
```

## Risk Mitigation

### Tool Reliability
- **Consistent Availability**: Ensuring tool is always available
  - *Mitigation*: Proper MCP tool registration and error handling
- **Parameter Validation**: Ensuring proper parameter handling
  - *Mitigation*: Comprehensive parameter validation and error responses

### Cancellation Effectiveness
- **Cancellation Speed**: Ensuring cancellation occurs within 1 second
  - *Mitigation*: Efficient cancellation processing and timeout monitoring
- **Complete Cancellation**: Ensuring all tasks and queues are properly cleared
  - *Mitigation*: Comprehensive cancellation validation and testing

### Error Handling
- **Invalid Input Handling**: Graceful handling of invalid parameters
  - *Mitigation*: Robust parameter validation and error responses
- **System Error Recovery**: Handling system-level errors gracefully
  - *Mitigation*: Comprehensive error handling and fallback responses

## Usage Patterns

### Basic Cancellation
[Conversation Reference: User's MCP tool usage pattern]

```typescript
// MCP client usage
const result = await mcp.call("ssh_cancel_command", {
  sessionName: "my-session"
});

if (result.success && result.action === "cancelled") {
  console.log(`Cancelled task: ${result.cancelledTask.command}`);
  console.log(`Cleared ${result.clearedQueue.queuedCommands} queued commands`);
}
```

### Error Handling Pattern
```typescript
// Handle various response scenarios
switch (result.action) {
  case "cancelled":
    // Task successfully cancelled
    break;
  case "no_task":
    // No task was running
    break;
  case "error":
    // Handle error condition
    break;
}
```