# Story: Unified Cancellation Processing

## Story Overview
**Story ID:** 03_Story_UnifiedCancellationProcessing
**Feature:** 04_Feat_UniversalCancellationSystem
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning

## User Story
[Conversation Reference: User specified unified approach with "Browser and MCP commands use identical code path" and "Cancel running command + clear entire queue (KISS approach)"]

As a system architect
I want unified cancellation processing for both MCP and browser sources
So that cancellation behavior is consistent and maintenance complexity is minimized

## Problem Context
[Conversation Reference: User's KISS approach and unified code path requirements]

Cancellation requests from MCP and browser sources need identical processing to ensure consistent behavior and simplified maintenance through unified code paths.

## Acceptance Criteria

### Unified Processing Pipeline
[Conversation Reference: User specified unified code path approach]

```gherkin
Given cancellation is triggered from MCP or browser source
When cancellation processing occurs
Then both sources use the same processing pipeline
And no source-specific cancellation logic exists
And behavior is identical regardless of cancellation source
```

### Queue Clearing Consistency
[Conversation Reference: User specified "Cancel running command + clear entire queue (KISS approach)"]

```gherkin
Given cancellation occurs from any source
When queue clearing is processed
Then the active command is cancelled
And the entire session queue is cleared using KISS approach
And no queued commands remain regardless of source
```

### State Management Consistency
```gherkin
Given cancellation processing completes
When task and session state is updated
Then state transitions are identical for both sources
And session state consistency is maintained
And subsequent status polls show identical results
```

### Notification Coordination
[Conversation Reference: User specified WebSocket notifications]

```gherkin
Given cancellation completes from any source
When notifications are generated
Then appropriate notifications are sent to all interfaces
And MCP clients receive cancellation responses
And browser receives WebSocket cancellation notifications
```

## Technical Implementation

### Unified Processing Architecture
[Conversation Reference: Based on user's unified code path requirement]

```typescript
interface CancellationRequest {
  sessionName: string;
  source: 'mcp' | 'browser';
  timestamp: Date;
  requestId?: string;
}

class UnifiedCancellationProcessor {
  async processCancellation(request: CancellationRequest): Promise<CancellationResult> {
    // Single processing pipeline for all sources
    const session = await this.validateSession(request.sessionName);
    const activeTask = await this.getActiveTask(session);

    if (activeTask) {
      await this.cancelActiveTask(activeTask);
      await this.clearSessionQueue(session);
      await this.updateTaskState(activeTask, 'cancelled');
      await this.notifyInterfaces(request, session);
    }

    return this.generateResponse(request, activeTask);
  }
}
```

### Processing Components
- **Source-Agnostic Validation**: Validate requests independent of source
- **Unified Task Cancellation**: Single method for canceling active tasks
- **Consistent Queue Clearing**: Same queue clearing logic for all sources
- **Coordinated Notifications**: Send appropriate notifications to all interfaces

### KISS Queue Clearing
[Conversation Reference: User specified KISS approach for queue clearing]

```typescript
async clearSessionQueue(session: SessionData): Promise<void> {
  // KISS approach: clear everything
  session.commandQueue = [];
  session.queuedCommands = 0;
  await this.updateSessionState(session);
}
```

## Implementation Steps

1. **Unified Processor Design**: Design single processing pipeline
2. **Source Detection**: Implement source detection without behavior divergence
3. **Queue Clearing Logic**: Implement KISS approach for queue clearing
4. **Notification Coordination**: Coordinate notifications across interfaces

## Testing Strategy

### Processing Consistency Testing
- **Identical Behavior**: Verify identical processing for both sources
- **Queue Clearing**: Test consistent queue clearing across sources
- **State Management**: Validate consistent state transitions

### Integration Testing
- **Source Integration**: Test integration with MCP and browser sources
- **Notification Delivery**: Test notification delivery to appropriate interfaces
- **Error Handling**: Test error handling consistency across sources

## Definition of Done

### Functional Requirements
- [ ] Unified cancellation processing pipeline for both MCP and browser sources
- [ ] Consistent queue clearing using KISS approach regardless of source
- [ ] Identical state management and transitions for all cancellation sources
- [ ] Coordinated notification delivery to appropriate interfaces

### Technical Requirements
- [ ] Single processing implementation serving both sources
- [ ] Source detection without behavioral divergence
- [ ] Thread-safe processing for concurrent cancellation requests
- [ ] Integration with existing session and task management systems

### Validation Requirements
- [ ] Processing behavior verified as identical across sources
- [ ] Queue clearing consistency confirmed for all scenarios
- [ ] State management consistency validated
- [ ] Notification delivery tested for all interface combinations

## Processing Flow Design

### Unified Processing Flow
[Conversation Reference: User's unified approach]

```
Cancellation Request (MCP/Browser)
    ↓
Source Detection & Validation
    ↓
Session & Task Validation
    ↓
Active Task Cancellation
    ↓
Complete Queue Clearing (KISS)
    ↓
State Updates & Persistence
    ↓
Coordinated Notifications
    ↓
Response Generation
```

### Source-Specific Customization Points
- **Request Format**: Different input formats from MCP vs WebSocket
- **Response Format**: Different response formats for different interfaces
- **Notification Channels**: Different notification channels (MCP response vs WebSocket)

## Integration Points

### MCP Integration
[Conversation Reference: User's ssh_cancel_command MCP tool]

- **Request Processing**: Process MCP cancellation requests
- **Response Generation**: Generate appropriate MCP responses
- **Error Handling**: Handle MCP-specific error scenarios
- **Protocol Compliance**: Maintain MCP protocol compliance

### WebSocket Integration
[Conversation Reference: User's browser Ctrl-C capture]

- **Message Processing**: Process WebSocket cancellation messages
- **Notification Delivery**: Deliver cancellation notifications via WebSocket
- **Connection Management**: Handle WebSocket connection states
- **Browser Communication**: Maintain browser communication protocols

### Session Management Integration
- **Session Validation**: Validate session existence and state
- **Task Management**: Integrate with task lifecycle management
- **State Persistence**: Persist cancellation state changes
- **Resource Cleanup**: Coordinate resource cleanup across systems

## KISS Implementation Philosophy

### Simplicity First
[Conversation Reference: User's KISS approach]

- **Clear Everything**: Clear entire queue instead of selective clearing
- **Unified Logic**: Single processing path instead of source-specific logic
- **Direct Actions**: Direct cancellation without complex state machines
- **Immediate Effect**: Immediate cancellation without delays or retries

### Minimal Complexity
- **No Partial Cancellation**: Cancel active task and clear all queued tasks
- **No Recovery Logic**: No attempt to recover or restart cancelled tasks
- **No Complex State**: Simple cancelled state without sub-states
- **No Rollback**: No rollback mechanisms for cancellation operations

## Risk Mitigation

### Processing Consistency
- **Behavioral Divergence**: Different behavior for different sources
  - *Mitigation*: Comprehensive testing and unified processing validation
- **State Inconsistency**: Inconsistent state updates across sources
  - *Mitigation*: Atomic state operations and validation procedures

### System Integration
- **Notification Delivery**: Ensuring notifications reach appropriate interfaces
  - *Mitigation*: Robust notification delivery and acknowledgment systems
- **Error Propagation**: Ensuring errors are handled consistently
  - *Mitigation*: Unified error handling and propagation mechanisms

### Performance Impact
- **Processing Overhead**: Unified processing adding overhead
  - *Mitigation*: Optimized processing pipeline and efficient implementations
- **Concurrency Issues**: Concurrent cancellation requests causing conflicts
  - *Mitigation*: Thread-safe processing and proper synchronization