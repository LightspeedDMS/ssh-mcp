# Feature: Long-Running Command Polling

## Feature Overview
**Feature ID:** 01_Feat_LongRunningCommandPolling
**Epic:** LongRunningCommandSupport
**Priority:** Critical
**Status:** Planning
**Created:** 2025-09-15

## Feature Description
Complete implementation of asynchronous mode transition and polling workflow for commands exceeding 60 seconds. This feature enables MCP clients to handle long-running commands without blocking, providing immediate async notifications and comprehensive polling capabilities for state and output retrieval.

## Business Value
### Problem Addressed
MCP clients currently block when executing commands that take longer than 15 seconds, leading to timeouts and inability to execute legitimate long-running operations like system updates, builds, or data processing tasks.

### Solution Provided
- Non-blocking command execution for operations >60 seconds
- Immediate async mode notification to MCP clients
- Comprehensive polling API for state and output retrieval
- Result persistence until next command execution

## Technical Design
### Architecture Components
1. **60-Second Timer**: Simple timer in ssh_exec to detect threshold
2. **Session Fields**: Add 6 fields to SessionData for results
3. **Polling API**: Simple endpoint returning session state

### State Transitions
```
EXECUTING (0-60s) → ASYNC_MODE (>60s) → COMPLETED/FAILED/CANCELLED
```

### Session Fields Added
```typescript
// Added to existing SessionData interface:
lastCommand?: string
lastOutput?: string
lastExitCode?: number
lastState?: 'running' | 'completed' | 'failed' | 'cancelled'
lastStartTime?: number
lastEndTime?: number
```

## User Stories

### Story Breakdown
[ ] **01_Story_AsyncModeTransition** - 60-second threshold detection and notification
[ ] **02_Story_PollingWorkflow** - Complete polling API implementation
[ ] **03_Story_ResultPersistence** - Result fields in session until next command

### Story Dependencies
1. AsyncModeTransition must complete first (foundation)
2. PollingWorkflow depends on AsyncModeTransition
3. ResultPersistence integrates with PollingWorkflow

## Acceptance Criteria
```gherkin
Feature: Long-Running Command Polling
  As an MCP client developer
  I want to execute long-running commands without blocking
  So that my application remains responsive during lengthy operations

  Scenario: Automatic async mode transition
    Given an SSH session "build-server" is established
    When I execute "ssh_exec" with command "make clean && make all"
    And the command runs for more than 60 seconds
    Then I receive an immediate response with async notification
    And the response includes session information for polling
    And the command continues executing in the background

  Scenario: Polling for command state
    Given a command is running in async mode in session "build-server"
    When I call "ssh_get_long_running_command_state" with sessionName
    Then I receive the current state as "running"
    And I receive accumulated output so far
    And the response time is less than 50ms

  Scenario: Retrieving completed command results
    Given a long-running command has completed
    When I poll for the final state
    Then I receive state as "completed"
    And I receive the complete command output
    And I receive the exit code
    And the results remain available for subsequent polls

  Scenario: Result persistence across polls
    Given a completed long-running command with results
    When I poll multiple times with sessionName
    Then I receive identical complete results each time
    And the results persist until a new command is executed
```

## Implementation Requirements
### API Modifications
1. **ssh_exec Enhancement**
   - Add 60-second timer
   - Return async notification after 60 seconds
   - Store command info in session fields
   - Maintain backward compatibility

2. **New API: ssh_get_long_running_command_state**
   - Accept sessionName parameter only
   - Return simple state object with output
   - Read from session fields

### Technical Constraints
- Session-based identification only (no command IDs)
- RAM-only storage in session fields
- Simple state tracking

## Testing Strategy
### Test Scenarios
1. **Threshold Detection Tests**
   - Command at 59 seconds (remains sync)
   - Command at 61 seconds (switches to async)
   - Exact 60-second boundary behavior

2. **Polling Tests**
   - Poll during execution
   - Poll after completion
   - Rapid polling stress test
   - Concurrent session polling

3. **Result Persistence Tests**
   - Results survive multiple polls
   - Results cleared on new command
   - Memory usage validation

### Test Commands
```bash
# Primary test - transitions at 60 seconds
sleep 120

# Just over threshold
sleep 65

# Under threshold (sync mode)
sleep 30

# Test with output
sleep 65 && echo "Done"
```

## Dependencies
### Technical Dependencies
- SSH2 library for command execution
- Session management system
- Simple timer functionality

### System Dependencies
- Session management infrastructure
- MCP protocol message handlers
- Command execution pipeline

## Risk Mitigation
### Identified Risks
1. **State Inconsistency**
   - Risk: State updates during transition
   - Mitigation: Simple field updates

2. **Process Management**
   - Risk: Commands not properly tracked
   - Mitigation: Store in session immediately

## Success Metrics
- Commands >60s transition to async mode
- Polling returns correct state
- Results persist until next command
- Backward compatibility maintained

## Documentation Requirements
- API documentation for new endpoints
- Example using sleep commands

## Release Criteria
- Sleep command tests passing
- Polling works correctly
- Backward compatibility verified