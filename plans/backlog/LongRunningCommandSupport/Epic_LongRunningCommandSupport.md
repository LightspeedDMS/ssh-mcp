# Epic: Long-Running Command Support

## Epic Overview
**Epic ID:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning
**Created:** 2025-09-15
**Updated:** 2025-09-15

## Executive Summary
Enable the SSH MCP server to handle commands that run for minutes to hours without blocking MCP clients, while maintaining backward compatibility and dual-input architecture (MCP + browser). The system will automatically switch to asynchronous mode for commands exceeding 60 seconds, provide polling capabilities for MCP clients, and maintain infinite wait support for browser users.

## Business Value
### Problem Statement
Currently, the SSH MCP server uses a 15-second timeout with nuclear fallback, which blocks MCP clients and prevents execution of legitimate long-running commands like system updates, builds, or data processing operations. This limitation forces users to work around the system rather than with it.

### Solution Benefits
- **Unblocked Operations**: MCP clients can initiate long-running commands and continue with other tasks
- **Browser Compatibility**: Browser users maintain familiar infinite-wait experience with visual feedback
- **Universal Control**: MCP clients gain authority to cancel any running command, including browser-initiated ones
- **Resource Efficiency**: Single command per session prevents resource exhaustion
- **Backward Compatibility**: Existing short commands continue working without modification

## Technical Architecture
### Core Design Principles
1. **60-Second Threshold**: Automatic transition from synchronous to asynchronous mode
2. **Session-Based Identification**: No command IDs - use sessionName only
3. **Single Command Rule**: One command per session at a time
4. **Simple RAM Storage**: Basic session fields, no complex systems
5. **Result Persistence**: Results persist until next command execution

### State Management
- **Command States**: `running`, `completed`, `cancelled`, `failed`
- **Storage**: Simple fields in existing SessionData interface (RAM-only)
- **Fields Added**: `lastCommand`, `lastOutput`, `lastExitCode`, `lastState`, `lastStartTime`, `lastEndTime`
- **Cleanup**: Automatic when next command starts

### API Specifications
- **Existing Modified**: `ssh_exec` returns async notification after 60 seconds
- **New APIs**:
  - `ssh_get_long_running_command_state(sessionName)`: Returns simple state object
  - `ssh_cancel_running_command(sessionName)`: Cancels current command in session

## Features

### Feature Breakdown
[ ] **01_Feat_LongRunningCommandPolling** - Async mode transition and polling workflow
[ ] **02_Feat_UniversalCommandCancellation** - MCP cancellation authority and notifications
[ ] **03_Feat_BrowserLongCommandCompatibility** - Browser infinite wait capability

### Implementation Order
1. **Feature 1** (LongRunningCommandPolling) - Must complete first
2. **Feature 2** (UniversalCommandCancellation) - Depends on Feature 1
3. **Feature 3** (BrowserLongCommandCompatibility) - Can develop in parallel

## Success Criteria
### Functional Requirements
- ✅ Commands >60s automatically switch to async mode
- ✅ MCP clients receive immediate async notification
- ✅ Polling API returns complete state and output
- ✅ MCP clients can cancel any running command
- ✅ Browser users see cancellation notifications
- ✅ Browser maintains infinite wait capability
- ✅ Results persist until next command
- ✅ Single long-running command per session enforced

### Performance Requirements
- Response time <100ms for async mode notification
- Polling response time <50ms
- Cancellation effect within 1 second

### Testing Requirements
- Primary testing with `sleep 120` and `sleep 65` commands
- Polling state retrieval validation
- Cancellation effectiveness testing
- WebSocket notification delivery for "[CANCELLED] Command terminated by MCP client"
- Backward compatibility with commands under 60 seconds

## Dependencies
### External Dependencies
- SSH2 library async command execution support
- WebSocket for browser notifications
- Process management for command cancellation

### Internal Dependencies
- Current session management system
- Existing MCP protocol implementation
- WebSocket browser terminal infrastructure

## Risk Assessment
### Technical Risks
- **Process Orphaning**: Commands continuing after cancellation
  - *Mitigation*: Proper signal handling via SSH channel
- **State Synchronization**: Browser/MCP state divergence
  - *Mitigation*: Single source of truth in session data

### Business Risks
- **Breaking Changes**: Impact on existing integrations
  - *Mitigation*: Full backward compatibility maintained
- **User Experience**: Confusion with async mode transition
  - *Mitigation*: Clear async notification message

## Acceptance Criteria
```gherkin
Feature: Long-Running Command Support
  As a system administrator
  I want to execute long-running commands without blocking
  So that I can perform system maintenance and monitoring tasks

  Scenario: Command switches to async mode after 60 seconds
    Given an SSH session is established
    When I execute a command that runs for more than 60 seconds
    Then the system switches to async mode
    And I receive an async notification with polling instructions
    And the command continues executing in the background

  Scenario: Polling for command state and output
    Given a long-running command is executing in async mode
    When I call ssh_get_long_running_command_state with sessionName
    Then I receive the current state (running/completed/failed/cancelled)
    And I receive any accumulated output
    And I receive the exit code if completed

  Scenario: MCP client cancels running command
    Given a long-running command is executing
    When an MCP client calls ssh_cancel_running_command with sessionName
    Then the command is terminated within 1 second
    And the state changes to "cancelled"
    And browser users see "[CANCELLED] Command terminated by MCP client"

  Scenario: Browser maintains infinite wait
    Given a browser user executes a long-running command
    When the command exceeds 60 seconds
    Then the browser continues waiting for completion
    And the terminal shows real-time output
    And the user can cancel via browser interface
```

## Implementation Notes
### Phase 1: Foundation (Feature 1)
- Implement 60-second threshold detection in ssh_exec
- Add simple session fields for state storage
- Create ssh_get_long_running_command_state API
- Return async notification to MCP client

### Phase 2: Control (Feature 2)
- Implement ssh_cancel_running_command API
- Send cancellation signal via SSH channel
- Broadcast "[CANCELLED] Command terminated by MCP client" to browser
- Update session state to cancelled

### Phase 3: Compatibility (Feature 3)
- Ensure browser continues waiting forever (no timeout changes)
- Maintain real-time output streaming
- Browser receives all notifications including cancellation

## Documentation Requirements
- API documentation for new endpoints
- Usage examples with sleep commands
- Browser behavior documentation

## Testing Strategy
### Primary Test Commands
- `sleep 120` - Test async mode transition at 60 seconds
- `sleep 65` - Test just over threshold
- `sleep 30` - Test commands under threshold (sync mode)

### Test Scenarios
- Command transitions to async mode after 60 seconds
- Polling returns correct state and output
- Cancellation works from MCP client
- Browser receives cancellation message
- Results persist until next command

## Release Strategy
- Test with sleep commands locally
- Verify backward compatibility
- Deploy with confidence

## Timeline Estimate
- **Feature 1**: 2 days (simple async mode and polling)
- **Feature 2**: 1 day (basic cancellation)
- **Feature 3**: 1 day (browser compatibility verified)
- **Testing**: 1 day
- **Total Estimate**: 5 days

## Dependencies and Blockers
### Prerequisites
- Current regression tests must pass
- Session management system stable
- WebSocket infrastructure operational

### Potential Blockers
- SSH2 library limitations
- Process management complexities
- Browser WebSocket compatibility issues