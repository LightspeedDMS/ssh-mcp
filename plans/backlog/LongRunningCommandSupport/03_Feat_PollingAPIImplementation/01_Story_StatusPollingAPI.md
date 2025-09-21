# Story: Status Polling API

## Story Overview
**Story ID:** 01_Story_StatusPollingAPI
**Feature:** 03_Feat_PollingAPIImplementation
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified "ssh_get_command_status for checking background task status"]

As an MCP client managing background tasks
I want to check background task status using ssh_get_command_status
So that I can monitor task progress and determine when results are available

## Problem Context
[Conversation Reference: User's polling architecture requires status checking API]

After receiving timeout errors from ssh_exec, MCP clients need a way to check the status of background tasks to monitor progress and determine completion.

## Acceptance Criteria

### MCP Tool Implementation
[Conversation Reference: User specified "ssh_get_command_status" as the API name]

```gherkin
Given the MCP server is running
When an MCP client calls ssh_get_command_status
Then the MCP tool is available and functional
And the tool accepts sessionName as a parameter
And proper MCP protocol responses are returned
```

### Task Status Reporting
```gherkin
Given a background task is running in a session
When ssh_get_command_status is called with the sessionName
Then the current task status is returned
And the status indicates 'running' state
And task execution information is included
```

### No Task State Handling
```gherkin
Given a session has no active or completed tasks
When ssh_get_command_status is called
Then a clear response indicating no task is returned
And the status indicates 'no_task' state
And no error condition is generated
```

### Session Validation
```gherkin
Given an invalid or non-existent sessionName
When ssh_get_command_status is called
Then an appropriate error response is returned
And the error clearly indicates the session issue
And no system errors occur
```

## Technical Implementation

### MCP Tool Definition
[Conversation Reference: Based on user's ssh_get_command_status specification]

```typescript
const sshGetCommandStatusTool: Tool = {
  name: "ssh_get_command_status",
  description: "Get status of background task running in SSH session",
  inputSchema: {
    type: "object",
    properties: {
      sessionName: {
        type: "string",
        description: "Name of the SSH session to check"
      }
    },
    required: ["sessionName"]
  }
};
```

### Implementation Components
- **Tool Registration**: Register ssh_get_command_status with MCP server
- **Parameter Validation**: Validate sessionName parameter
- **Session Lookup**: Locate session and associated task data
- **Status Response Generation**: Generate appropriate status responses

### Response Format
```typescript
interface StatusPollingResponse {
  success: boolean;
  sessionName: string;
  hasTask: boolean;
  taskState?: 'running' | 'completed' | 'failed' | 'cancelled';
  message: string;
}
```

## Implementation Steps

1. **MCP Tool Registration**: Register ssh_get_command_status tool
2. **Parameter Processing**: Implement sessionName parameter handling
3. **Session Integration**: Integrate with session management system
4. **Response Generation**: Implement status response generation

## Testing Strategy

### API Testing
- **Tool Availability**: Verify MCP tool is properly registered
- **Parameter Handling**: Test sessionName parameter processing
- **Response Format**: Validate response format consistency

### Session Integration Testing
- **Valid Sessions**: Test with existing sessions and tasks
- **Invalid Sessions**: Test with non-existent sessions
- **Empty Sessions**: Test with sessions having no tasks

## Definition of Done

### Functional Requirements
- [ ] ssh_get_command_status MCP tool implemented and registered
- [ ] SessionName parameter validation and processing
- [ ] Task status reporting for running, completed, and no-task states
- [ ] Proper error handling for invalid sessions

### Technical Requirements
- [ ] MCP protocol compliance for tool implementation
- [ ] Integration with session management system
- [ ] Thread-safe access to session task data
- [ ] Consistent response formatting

### Validation Requirements
- [ ] MCP tool accessible and functional from MCP clients
- [ ] Accurate task status reporting verified
- [ ] Error handling tested for all edge cases
- [ ] Response format consistency confirmed

## Integration Points

### Session Management Integration
[Conversation Reference: User's session-based task storage]

- **Session Lookup**: Access session data by sessionName
- **Task Data Access**: Retrieve task information from session storage
- **State Validation**: Verify current task state accuracy
- **Error Handling**: Handle missing or invalid sessions

### MCP Protocol Integration
- **Tool Registration**: Proper registration with MCP server
- **Parameter Schema**: Correct input schema definition
- **Response Protocol**: Compliant MCP response formatting
- **Error Responses**: Proper error response generation

## Error Handling Scenarios

### Session Not Found
```json
{
  "success": false,
  "error": "session_not_found",
  "message": "SSH session 'invalid-session' not found"
}
```

### No Active Task
```json
{
  "success": true,
  "sessionName": "user-session",
  "hasTask": false,
  "taskState": "no_task",
  "message": "No active or completed task in session"
}
```

### Active Task
```json
{
  "success": true,
  "sessionName": "user-session",
  "hasTask": true,
  "taskState": "running",
  "message": "Task is currently running"
}
```

## Risk Mitigation

### API Reliability
- **Consistent Availability**: Ensuring API is always available
  - *Mitigation*: Proper MCP tool registration and error handling
- **Response Accuracy**: Ensuring status information is current
  - *Mitigation*: Real-time access to session storage

### Error Handling
- **Invalid Input Handling**: Graceful handling of invalid parameters
  - *Mitigation*: Comprehensive parameter validation and error responses
- **System Error Recovery**: Handling system-level errors gracefully
  - *Mitigation*: Robust error handling and fallback responses