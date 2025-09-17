# Story: MCP Cancellation Capability

## Story Overview
**Story ID:** 01_Story_MCPCancellationCapability
**Feature:** 02_Feat_UniversalCommandCancellation
**Epic:** LongRunningCommandSupport
**Priority:** Critical
**Status:** Planning
**Story Points:** 2
**Created:** 2025-09-15

## User Story
**As an** MCP client developer
**I want** to cancel any running command on a session via MCP API
**So that** I can terminate long-running, stuck, or mistaken commands without destroying the entire session

## Story Description
Implement the simple MCP cancellation functionality with the new `ssh_cancel_running_command` API endpoint that takes only sessionName. Send cancellation signal via SSH channel and update session state to 'cancelled'. MCP clients can cancel any running command in a session.

## Acceptance Criteria
[x] **API Implementation** - ssh_cancel_running_command endpoint functional
[x] **Signal via SSH** - Send cancellation signal through SSH channel
[x] **State Update** - Session lastState changes to "cancelled"
[x] **Response Time** - Cancellation completes within 1 second

### Detailed Acceptance Criteria
```gherkin
Feature: MCP Cancellation Capability
  Background:
    Given an SSH session "admin-session" is established
    And proper permissions are configured

  Scenario: Cancel running command by session
    Given a command "sleep 120" is running on "admin-session"
    When I call "ssh_cancel_running_command" with:
      | sessionName | admin-session |
    Then cancellation signal is sent via SSH channel
    And the command state changes to "cancelled"
    And the response confirms cancellation success

  Scenario: Cancel when no command running
    Given no command is currently running
    When I call "ssh_cancel_running_command" with:
      | sessionName | admin-session |
    Then I receive an error response
    And the error indicates "No running command"

  Scenario: Simple cancellation via SSH
    Given a command "sleep 120" is running
    When cancellation is requested
    Then cancellation signal is sent via SSH channel
    And the command terminates within 1 second
    And session.lastState is set to "cancelled"

  Scenario: Invalid session cancellation
    When I try to cancel with non-existent sessionName
    Then I receive an error response
    And the error indicates "Session not found"

  Scenario: Concurrent cancellation attempts
    Given a command is being cancelled
    When another cancellation request arrives
    Then the second request receives "already cancelling" status
    And no duplicate signals are sent
    And the cancellation completes once
```

## Technical Design
### API Implementation
```typescript
interface CancelCommandRequest {
  sessionName: string
}

interface CancelCommandResponse {
  success: boolean
  sessionName: string
  message: string
}
```

### Cancellation Handler
```pseudocode
function cancelCommand(request) {
  // Validate session
  session = getSession(request.sessionName)
  if (!session) return error('Session not found')

  // Check for running command
  if (!session.lastCommand || session.lastState !== 'running') {
    return {
      success: false,
      message: 'No running command in session'
    }
  }

  // Send cancellation via SSH channel
  session.sshChannel.signal('KILL')

  // Update session state
  session.lastState = 'cancelled'
  session.lastEndTime = Date.now()

  return {
    success: true,
    sessionName: request.sessionName,
    message: 'Command cancelled successfully'
  }
}
```

### Signal Handling
```pseudocode
function sendCancellationSignal(session) {
  // Send cancellation signal via SSH channel
  session.sshChannel.signal('KILL')
  return true
}
```

### State Management
```pseudocode
function updateSessionAfterCancellation(session) {
  // Update session state
  session.lastState = 'cancelled'
  session.lastEndTime = Date.now()
}
```

## Implementation Tasks
[ ] **API Endpoint** - Create ssh_cancel_running_command handler
[ ] **Signal Sending** - Send signal via SSH channel
[ ] **State Management** - Update command state atomically
[ ] **Error Handling** - Handle edge cases gracefully

### Task Details
1. **API Implementation**
   - Define request/response schemas
   - Create MCP protocol handler
   - Validate sessionName parameter

2. **Signal Sending**
   - Send cancellation signal via SSH channel
   - Update session state to 'cancelled'

3. **Error Handling**
   - Session not found
   - No running command
   - Return appropriate error messages

## Testing Requirements
### Unit Tests
[ ] Signal sending accuracy
[ ] Grace period timing
[ ] State transition atomicity
[ ] Resource cleanup completeness
[ ] Error handling robustness

### Integration Tests
[ ] End-to-end cancellation flow
[ ] Process group termination
[ ] Concurrent cancellation handling
[ ] Recovery from failures

### Test Cases
```javascript
describe('MCP Cancellation Capability', () => {
  test('Cancel simple command', async () => {
    // Start sleep command
    // Request cancellation
    // Verify SIGTERM sent
    // Confirm termination
    // Check state update
  })

  test('Cancel sleep 120 command', async () => {
    // Start sleep 120
    // Request cancellation
    // Verify command terminated
    // Check state = 'cancelled'
  })

  test('Concurrent cancellation', async () => {
    // Start cancellation
    // Send second request
    // Verify proper handling
    // Check single termination
  })
})
```

## Dependencies
### Internal Dependencies
- Session management system
- Command execution tracking
- Process management utilities
- Feature 1 (async mode) for state

### External Dependencies
- Operating system signal APIs
- Process monitoring tools
- Child process management

## Definition of Done
[ ] All acceptance criteria met
[ ] API endpoint functional
[ ] Signal handling working
[ ] Process groups handled
[ ] State updates atomic
[ ] Resources cleaned up
[ ] Unit tests passing
[ ] Integration tests complete
[ ] Performance validated
[ ] Documentation updated
[ ] Code review approved

## Risk Assessment
### Technical Risks
1. **Signal Delivery Failure**
   - Risk: Signals not reaching process
   - Mitigation: Multiple delivery attempts

2. **Orphan Processes**
   - Risk: Child processes not terminated
   - Mitigation: Process group signaling

3. **State Corruption**
   - Risk: Inconsistent state after cancel
   - Mitigation: Atomic operations

## Performance Criteria
- Cancellation response: <1 second
- API response time: <100ms
- State update: <10ms

## Notes
- Simple SSH channel signal implementation
- Session state updates for cancellation tracking