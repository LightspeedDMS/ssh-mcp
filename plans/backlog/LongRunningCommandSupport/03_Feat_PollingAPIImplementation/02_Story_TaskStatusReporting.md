# Story: Task Status Reporting

## Story Overview
**Story ID:** 02_Story_TaskStatusReporting
**Feature:** 03_Feat_PollingAPIImplementation
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified comprehensive status information for polling]

As an MCP client monitoring background tasks
I want comprehensive task status information
So that I can understand task progress, timing, and execution details

## Problem Context
[Conversation Reference: User's requirement for complete task information retrieval]

Clients need detailed task information beyond simple state to make informed decisions about task management and result handling.

## Acceptance Criteria

### Comprehensive Status Information
```gherkin
Given a background task exists in a session
When ssh_get_command_status is called
Then comprehensive task information is returned
And task state (running/completed/failed/cancelled) is provided
And execution timing information is included
And command details are available
```

### Execution Timing Details
```gherkin
Given a task has been executing
When status is requested
Then start time is provided
And duration information is included
And end time is provided for completed tasks
And last activity timestamp is available
```

### Command Context Information
```gherkin
Given a task is being monitored
When status information is requested
Then the original command text is provided
And session context is included
And task execution environment details are available
```

### Real-time Status Updates
```gherkin
Given a task state changes during execution
When status is polled
Then the current state is immediately reflected
And status information is up-to-date
And no stale information is returned
```

## Technical Implementation

### Status Information Structure
[Conversation Reference: Based on user's comprehensive status requirement]

```typescript
interface TaskStatusInfo {
  sessionName: string;
  taskState: 'running' | 'completed' | 'failed' | 'cancelled' | 'no_task';
  command: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // milliseconds
  lastActivity: Date;
  pid?: number;
  executionEnvironment: {
    workingDirectory: string;
    environment: Record<string, string>;
  };
}
```

### Information Collection
- **State Tracking**: Collect current task state from session storage
- **Timing Calculation**: Calculate duration and timing information
- **Command Details**: Extract command text and execution context
- **Activity Monitoring**: Track last activity timestamps

### Real-time Updates
- **State Synchronization**: Ensure status reflects current task state
- **Activity Tracking**: Update last activity on task events
- **Duration Calculation**: Calculate real-time duration information
- **State Transitions**: Track and report state changes

## Implementation Steps

1. **Status Data Structure**: Define comprehensive status information structure
2. **Information Collection**: Implement collection of all status details
3. **Real-time Updates**: Ensure status information is current
4. **Response Formatting**: Format comprehensive status responses

## Testing Strategy

### Information Accuracy Testing
- **Status Accuracy**: Verify all status information is accurate
- **Timing Precision**: Test timing information precision
- **Command Details**: Validate command context information

### Real-time Update Testing
- **State Changes**: Test status updates when task state changes
- **Activity Updates**: Verify last activity tracking
- **Duration Accuracy**: Test real-time duration calculation

## Definition of Done

### Functional Requirements
- [ ] Comprehensive task status information provided
- [ ] Accurate execution timing details included
- [ ] Complete command context information available
- [ ] Real-time status updates reflecting current state

### Technical Requirements
- [ ] Efficient information collection from session storage
- [ ] Accurate timing calculations and tracking
- [ ] Thread-safe access to task information
- [ ] Consistent information formatting

### Validation Requirements
- [ ] Status information accuracy verified across all task states
- [ ] Timing information precision confirmed
- [ ] Real-time updates validated for state changes
- [ ] Command context information completeness verified

## Status Information Examples

### Running Task Status
```json
{
  "success": true,
  "sessionName": "user-session-123",
  "taskState": "running",
  "command": "find /var/log -name '*.log' | xargs grep ERROR",
  "startTime": "2025-09-20T10:30:00.000Z",
  "duration": 45000,
  "lastActivity": "2025-09-20T10:30:45.000Z",
  "pid": 12345,
  "executionEnvironment": {
    "workingDirectory": "/home/user",
    "environment": {"PATH": "/usr/bin:/bin", "USER": "admin"}
  }
}
```

### Completed Task Status
```json
{
  "success": true,
  "sessionName": "user-session-123",
  "taskState": "completed",
  "command": "backup-database.sh",
  "startTime": "2025-09-20T10:00:00.000Z",
  "endTime": "2025-09-20T10:15:30.000Z",
  "duration": 930000,
  "lastActivity": "2025-09-20T10:15:30.000Z"
}
```

## Integration Points

### Session Storage Integration
[Conversation Reference: User's session-based task storage]

- **Information Retrieval**: Access comprehensive task data from session
- **State Monitoring**: Monitor task state changes in real-time
- **Activity Tracking**: Track and update last activity timestamps
- **Context Preservation**: Maintain command and environment context

### Threading Integration
- **Real-time Updates**: Receive status updates from background threads
- **Activity Notifications**: Get activity notifications from executing tasks
- **State Synchronization**: Synchronize task state across thread boundaries
- **Performance Monitoring**: Track task performance and resource usage

## Performance Considerations

### Information Collection Efficiency
- **Fast Retrieval**: Quick access to status information
- **Minimal Overhead**: Low overhead for status collection
- **Efficient Calculations**: Fast timing and duration calculations
- **Optimized Formatting**: Efficient response formatting

### Real-time Update Performance
- **State Change Detection**: Fast detection of task state changes
- **Activity Monitoring**: Efficient last activity tracking
- **Update Propagation**: Quick propagation of status changes

## Risk Mitigation

### Information Accuracy
- **Stale Data**: Ensuring status information is always current
  - *Mitigation*: Real-time access to session storage and atomic updates
- **Timing Accuracy**: Ensuring timing information is precise
  - *Mitigation*: High-resolution timing and consistent time sources

### Performance Impact
- **Status Collection Overhead**: Minimizing overhead of status collection
  - *Mitigation*: Efficient data structures and optimized collection methods
- **Real-time Update Cost**: Managing cost of real-time status updates
  - *Mitigation*: Event-driven updates and efficient synchronization