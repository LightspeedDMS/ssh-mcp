# Story: Async Timeout Handling

## Story Overview
**Story ID:** 03_Story_AsyncTimeoutHandling
**Feature:** 02_Feat_AsyncExecutionViaThreading
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified "Timed wait with timeout → return error to MCP client → keep task running in background"]

As an MCP client executing commands with timeouts
I want to receive timeout errors when commands exceed asyncTimeout
So that I can handle timeouts gracefully while commands continue in background

## Problem Context
[Conversation Reference: User's architectural requirement for timeout error responses with background continuation]

MCP clients need timeout feedback to manage their workflows while allowing long-running commands to continue execution in background for later result retrieval.

## Acceptance Criteria

### Timeout Error Response
[Conversation Reference: User specified "return error to MCP client" when timeout occurs]

```gherkin
Given an MCP command is executed with asyncTimeout parameter
When the timeout duration is exceeded
Then an error response is returned to the MCP client
And the error clearly indicates a timeout occurred
And the error includes polling instructions for result retrieval
```

### Background Task Continuation
[Conversation Reference: User specified "keep task running in background"]

```gherkin
Given an MCP command times out and returns an error
When the timeout response is sent to the client
Then the background task continues executing
And the task remains accessible for polling
And no interruption to command execution occurs
```

### Async Mode Transition
[Conversation Reference: User specified "ssh_exec returns ERROR when going async (not backward compatible)"]

```gherkin
Given an MCP command transitions to async mode due to timeout
When the transition occurs
Then ssh_exec returns an ERROR response (intentionally not backward compatible)
And the error response clearly explains async mode transition
And polling instructions are provided to the client
```

### Clean Error Messaging
[Conversation Reference: User emphasized "Clean error messages for dead tasks (graceful failure)"]

```gherkin
Given a timeout error occurs
When the error response is generated
Then the error message is clear and actionable
And polling instructions are included
And the session and task information is provided
```

## Technical Implementation

### Timeout Detection
[Conversation Reference: Based on user's asyncTimeout parameter requirement]

- **Thread-Level Timeouts**: Monitor asyncTimeout within background threads
- **Non-Blocking Timeout**: Timeout detection without interrupting execution
- **State Transition**: Transition task to async mode on timeout
- **Error Generation**: Generate appropriate timeout error responses

### Error Response Format
```typescript
interface AsyncTimeoutError {
  success: false;
  error: "async_timeout_exceeded";
  message: "Command exceeded asyncTimeout, switched to background execution";
  sessionName: string;
  pollingInstructions: {
    statusCommand: "ssh_get_command_status";
    sessionName: string;
  };
  backgroundTaskId: string;
}
```

## Implementation Steps

1. **Timeout Monitoring**: Implement asyncTimeout monitoring in background threads
2. **Error Response System**: Create timeout error response generation
3. **Async Mode Transition**: Implement smooth transition to async mode
4. **Polling Instructions**: Generate clear polling guidance for clients

## Testing Strategy

### Timeout Behavior Testing
- **Timeout Detection**: Verify timeout detection at specified intervals
- **Error Response**: Test error response generation and format
- **Background Continuation**: Confirm tasks continue after timeout

### Error Message Testing
- **Message Clarity**: Verify error messages are clear and actionable
- **Polling Instructions**: Test polling instruction accuracy
- **Information Completeness**: Ensure all necessary information included

## Definition of Done

### Functional Requirements
- [ ] Timeout errors returned to MCP clients when asyncTimeout exceeded
- [ ] Background tasks continue execution after timeout responses
- [ ] Async mode transition implemented with ERROR responses
- [ ] Clear error messages with polling instructions provided

### Technical Requirements
- [ ] Thread-level timeout monitoring without execution interruption
- [ ] Proper error response formatting and transmission
- [ ] Async mode state tracking in session data
- [ ] Integration with session task storage system

### Validation Requirements
- [ ] Timeout detection accuracy verified within specified intervals
- [ ] Error responses contain complete information for client handling
- [ ] Background task continuation confirmed after timeout responses
- [ ] Polling instructions tested for accuracy and usability

## Error Response Examples

### Timeout Error Response
[Conversation Reference: User's requirement for clear error communication]

```json
{
  "success": false,
  "error": "async_timeout_exceeded",
  "message": "Command 'long-running-process' exceeded 30s asyncTimeout, continuing in background",
  "sessionName": "user-session-123",
  "asyncTimeout": 30000,
  "backgroundExecution": true,
  "polling": {
    "statusCommand": "ssh_get_command_status",
    "sessionName": "user-session-123",
    "instructions": "Use ssh_get_command_status to check completion status and retrieve results"
  }
}
```

## Integration Points

### Session Storage Integration
[Conversation Reference: User's session-based task storage]

- **State Updates**: Update session task state to 'async_mode' on timeout
- **Error Tracking**: Store timeout information in session for debugging
- **Polling Preparation**: Ensure session data ready for polling queries

### Threading Integration
- **Timeout Monitoring**: Monitor timeouts within background threads
- **Non-Interrupting Detection**: Detect timeouts without stopping execution
- **State Communication**: Communicate timeout events to main thread

## Risk Mitigation

### Timeout Accuracy
- **Timing Precision**: Ensure accurate timeout detection
  - *Mitigation*: Proper timing mechanisms and thread synchronization
- **Race Conditions**: Timeout detection racing with command completion
  - *Mitigation*: Atomic state transitions and proper synchronization

### Error Handling
- **Error Response Delivery**: Ensuring error responses reach MCP clients
  - *Mitigation*: Robust error response transmission and validation
- **Information Completeness**: Error responses containing all necessary information
  - *Mitigation*: Comprehensive error response validation and testing

## Client Experience

### Workflow Impact
[Conversation Reference: User's async mode design philosophy]

- **Immediate Feedback**: Clients receive immediate timeout feedback
- **Workflow Continuation**: Clients can continue with other operations
- **Result Retrieval**: Clients can poll for results when ready
- **Clear Communication**: Error messages guide client behavior

### Backward Compatibility
[Conversation Reference: User specified "not backward compatible" intentionally]

- **Breaking Change**: Intentional breaking change for async mode
- **Clear Migration**: Error messages guide clients to new polling workflow
- **No Fallbacks**: No backward compatibility mechanisms provided