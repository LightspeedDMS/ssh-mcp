# Feature: Polling API Implementation

## Feature Overview
**Feature ID:** 03_Feat_PollingAPIImplementation
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## Problem Statement
[Conversation Reference: User specified "ssh_get_command_status for checking background task status", "Return completion results when task finishes", "Clean error messages for dead tasks (graceful failure)"]

MCP clients need ability to check status and retrieve results from background tasks after timeout errors, requiring dedicated polling API for task status monitoring.

## Solution Approach
[Conversation Reference: User outlined polling API with status checking and result retrieval]

Implement ssh_get_command_status API that provides background task status, output, and completion results with graceful error handling for dead or failed tasks.

## User Stories

### Story Breakdown
- [ ] **01_Story_StatusPollingAPI** - Implement ssh_get_command_status MCP tool
- [ ] **02_Story_TaskStatusReporting** - Provide comprehensive task status information
- [ ] **03_Story_ResultRetrieval** - Return complete task results when finished
- [ ] **04_Story_DeadTaskHandling** - Handle dead tasks with clean error messages

## Acceptance Criteria

### Status Polling API
[Conversation Reference: User specified "ssh_get_command_status for checking background task status"]

```gherkin
Given a background task is running or completed
When an MCP client calls ssh_get_command_status with sessionName
Then the current task status is returned
And task state (running/completed/failed/cancelled) is provided
And task execution information is included
```

### Result Retrieval
[Conversation Reference: User specified "Return completion results when task finishes"]

```gherkin
Given a background task has completed execution
When ssh_get_command_status is called
Then complete task results are returned
And stdout output is provided
And stderr output is provided
And exit code is included
```

### Dead Task Handling
[Conversation Reference: User emphasized "Clean error messages for dead tasks (graceful failure)"]

```gherkin
Given a background task has died or failed unexpectedly
When ssh_get_command_status is called
Then a clean error message is returned
And the failure reason is clearly explained
And graceful failure information is provided
```

### Status Information Completeness
```gherkin
Given any background task state
When status is polled
Then comprehensive task information is provided
And execution timing is included
And command details are available
And session context is provided
```

## Technical Implementation

### API Specification
[Conversation Reference: Based on user's ssh_get_command_status requirement]

```typescript
interface CommandStatusRequest {
  sessionName: string;
}

interface CommandStatusResponse {
  success: boolean;
  sessionName: string;
  taskState: 'running' | 'completed' | 'failed' | 'cancelled' | 'no_task';
  command?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  lastActivity?: Date;
}
```

### Implementation Components
- **Status Query Engine**: Query session task storage for current status
- **Result Aggregation**: Collect complete task results for response
- **Error Detection**: Detect and handle dead or failed tasks
- **Response Formatting**: Format comprehensive status responses

## Dependencies
**Requires**: Feature 2 (Async Execution via Threading) must be completed
**Blocks**: Feature 4 can develop in parallel

## Testing Strategy

### Status API Testing
- **Status Accuracy**: Verify status information accuracy
- **Result Completeness**: Test complete result retrieval
- **Error Handling**: Validate dead task error handling

### Integration Testing
- **Session Storage Integration**: Test integration with session task storage
- **Threading Integration**: Verify status updates from background threads
- **MCP Protocol Integration**: Test MCP tool implementation

## Success Criteria

### Core API Functionality
✅ **Status Polling**: ssh_get_command_status provides accurate task status
✅ **Result Retrieval**: Complete task results returned when finished
✅ **Dead Task Handling**: Clean error messages for failed tasks
✅ **Comprehensive Information**: All relevant task information included

### Integration Requirements
✅ **Session Storage Integration**: Seamless integration with session task storage
✅ **Real-time Updates**: Status reflects current task state accurately
✅ **Error Resilience**: Graceful handling of all error conditions
✅ **MCP Protocol Compliance**: Proper MCP tool implementation

## Risk Mitigation

### API Reliability
- **Status Accuracy**: Ensuring status information is always current
  - *Mitigation*: Real-time session storage updates and atomic state access
- **Result Completeness**: Ensuring all task results are captured
  - *Mitigation*: Comprehensive result storage and validation

### Error Handling
- **Dead Task Detection**: Properly detecting when tasks have died
  - *Mitigation*: Thread monitoring and health checking mechanisms
- **Graceful Failure**: Providing meaningful error messages
  - *Mitigation*: Comprehensive error classification and messaging