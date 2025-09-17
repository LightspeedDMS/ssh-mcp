# Story: Async Mode Transition

## Story Overview
**Story ID:** 01_Story_AsyncModeTransition
**Feature:** 01_Feat_LongRunningCommandPolling
**Epic:** LongRunningCommandSupport
**Priority:** Critical
**Status:** Planning
**Story Points:** 3
**Created:** 2025-09-15

## User Story
**As a** MCP client developer
**I want** commands that exceed 60 seconds to automatically switch to async mode
**So that** my client application doesn't block waiting for long-running operations to complete

## Story Description
Implement the core mechanism that detects when a command execution exceeds 60 seconds and automatically transitions it to asynchronous mode. This includes sending an immediate async notification to the MCP client with instructions for polling, while allowing the command to continue executing in the background.

## Acceptance Criteria
[x] **Threshold Detection** - System detects 55-second execution boundary
[x] **Async Notification** - MCP client receives immediate async response
[x] **Command Continuation** - Command continues executing after transition
[x] **Session State Tracking** - Command state properly tracked in session
[x] **State Management** - Command state properly tracked as "running"
[x] **Backward Compatibility** - Commands <55s work unchanged

### Detailed Acceptance Criteria
```gherkin
Feature: Async Mode Transition
  Background:
    Given an SSH session "test-session" is established
    And the session is ready to execute commands

  Scenario: Command under 60 seconds remains synchronous
    When I execute command "sleep 30 && echo 'Done'"
    Then I receive the complete response after 30 seconds
    And the response contains "Done"
    And no async notification is sent

  Scenario: Command exceeds 60 seconds triggers async mode
    When I execute command "sleep 65 && echo 'Complete'"
    Then I receive an async notification at 60 seconds
    And the notification contains session information
    And the notification indicates async mode
    And the command continues running in background

  Scenario: Async notification structure
    Given a command "sleep 70" is executing
    When 60 seconds have elapsed
    Then the async notification includes:
      | field           | type     | description                    |
      | mode            | string   | "async"                       |
      | sessionName     | string   | Session identifier            |
      | message         | string   | Instructions for polling      |

  Scenario: Multiple commands in sequence
    Given a command is running in async mode
    When I attempt to execute another command
    Then I receive an error indicating a command is already running
    And the error includes the current command details
    And I'm instructed to wait or cancel the running command

  Scenario: Exact 60-second boundary
    When I execute a command that completes at exactly 60 seconds
    Then the command completes synchronously
    And no async transition occurs
    And I receive the complete results
```

## Technical Design
### Implementation Components
1. **Simple Timer**
   ```pseudocode
   // In ssh_exec handler:
   const timer = setTimeout(() => {
     if (stillRunning) {
       // Store in session fields
       session.lastCommand = command
       session.lastState = 'running'
       session.lastStartTime = startTime

       // Send async notification
       sendAsyncNotification()
     }
   }, 60000)
   ```

2. **Async Notification**
   ```pseudocode
   function sendAsyncNotification(session) {
     return {
       mode: 'async',
       sessionName: session.name,
       message: 'Command exceeded 60s limit. Switched to async mode. Available actions: ssh_get_long_running_command_state (poll), ssh_cancel_running_command'
     }
   }
   ```

3. **Session Fields Update**
   ```typescript
   // Simple field updates in SessionData:
   session.lastCommand = commandText
   session.lastOutput = '' // Accumulate as command runs
   session.lastState = 'running'
   session.lastStartTime = Date.now()
   // lastEndTime and lastExitCode set when complete
   ```

## Implementation Tasks
[ ] **Timer Implementation** - Add 60-second setTimeout in ssh_exec
[ ] **Session Fields** - Add 6 fields to SessionData interface
[ ] **Async Notification** - Return async response at 60 seconds
[ ] **Background Execution** - Ensure command continues after notification
[ ] **State Updates** - Update session fields as command progresses

### Task Details
1. **Timer Implementation**
   - Add setTimeout(60000) in ssh_exec
   - Clear timer if command completes early
   - Test with sleep commands

2. **Session Fields**
   - Add 6 fields to SessionData type
   - Initialize on command start
   - Update as command runs
   - Clear on next command

3. **Async Notification**
   - Return specific message format
   - Include sessionName for polling
   - Send via MCP response

4. **Background Execution**
   - Continue collecting output
   - Update session fields
   - Handle completion/failure

## Testing Requirements
### Unit Tests
[ ] Timer triggers at exactly 60 seconds
[ ] State transitions are atomic
[ ] Session state tracking works correctly
[ ] Notification structure is correct
[ ] Commands continue after transition

### Integration Tests
[ ] End-to-end async transition flow
[ ] Multiple session handling
[ ] Error recovery scenarios
[ ] Resource cleanup validation

### Test Cases
```javascript
describe('Async Mode Transition', () => {
  test('sleep 30 remains synchronous', async () => {
    // Execute sleep 30
    // Verify synchronous completion
    // Check no async notification
  })

  test('sleep 65 switches to async', async () => {
    // Execute sleep 65
    // Verify async notification at 60s
    // Check session.lastState = 'running'
  })

  test('sleep 120 for full async flow', async () => {
    // Execute sleep 120
    // Get async notification at 60s
    // Poll for completion
  })
})
```

## Dependencies
### Internal Dependencies
- Session management system
- Command execution pipeline
- MCP protocol handlers
- WebSocket communication layer

### External Dependencies
- Timer/setTimeout implementation
- Process management APIs

## Definition of Done
[ ] All acceptance criteria met
[ ] Sleep command tests passing
[ ] Code reviewed and approved
[ ] Documentation updated
[ ] Backward compatibility verified
[ ] Error scenarios handled

## Risk Assessment
### Technical Risks
1. **Timer Accuracy**
   - Risk: Timer drift affecting 60s boundary
   - Mitigation: Use high-resolution timers

2. **State Race Conditions**
   - Risk: Concurrent state updates
   - Mitigation: Atomic state operations

3. **Memory Leaks**
   - Risk: Timers not cleaned up
   - Mitigation: Proper cleanup handlers

## Performance Criteria
- Async notification sent at 60 seconds
- Command continues running
- Session fields updated correctly

## Notes
- Test primarily with sleep commands
- Ensure timer is cleared if command completes before 60s
- Session-based identification only (no command IDs)