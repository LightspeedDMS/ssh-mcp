# Story: Result Persistence

## Story Overview
**Story ID:** 03_Story_ResultPersistence
**Feature:** 01_Feat_LongRunningCommandPolling
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning
**Story Points:** 2
**Created:** 2025-09-15

## User Story
**As a** MCP client developer
**I want** command results to persist after completion until the next command
**So that** I can retrieve results multiple times without data loss and handle disconnections gracefully

## Story Description
Add simple fields to the existing session object to store completed command results. When a long-running command finishes, store the result in the session. When a new command starts, clear the previous result. No complex storage system needed - just session fields.

## Acceptance Criteria
[x] **Session Fields** - Add result fields to existing session object
[x] **Result Storage** - Store command results in session on completion
[x] **Persistent Polling** - Results retrievable multiple times
[x] **Simple Cleanup** - Clear results when new command starts
[x] **Memory Efficient** - No separate storage system needed

### Detailed Acceptance Criteria
```gherkin
Feature: Result Persistence
  Background:
    Given an SSH session "data-session" is established
    And a command "echo 'Test Output'" has completed in async mode

  Scenario: Results stored in session on completion
    When the command completes with exit code 0
    Then the session contains result fields:
      | field          | value                    |
      | lastCommand    | "echo 'Test Output'"    |
      | lastOutput     | "Test Output"           |
      | lastExitCode   | 0                       |
      | lastState      | "completed"             |
      | lastStartTime  | <timestamp>             |
      | lastEndTime    | <timestamp>             |

  Scenario: Multiple polls return same results
    Given command results are stored in session
    When I poll 5 times
    Then all polls return identical results
    And session fields remain unchanged

  Scenario: Results cleared on new command
    Given session has completed command results
    When I execute a new command "pwd"
    Then all lastCommand* fields are cleared
    And the new command becomes active

  Scenario: No command result available
    Given session has no completed long-running command
    When I poll for results
    Then response indicates no long-running command
    And suggests available actions
```

## Technical Design
### Session Field Extension
```pseudocode
// Add to existing SessionData interface:
interface SessionData {
  // ... existing fields ...

  // Long-running command result fields (simple!)
  lastCommand?: string
  lastOutput?: string
  lastExitCode?: number
  lastState?: 'completed' | 'failed' | 'cancelled'
  lastStartTime?: timestamp
  lastEndTime?: timestamp
  lastError?: string
}
```

### Implementation Logic
```pseudocode
// When command completes:
function onCommandComplete(sessionData, command) {
  // Store results in session fields
  sessionData.lastCommand = command.text
  sessionData.lastOutput = command.output
  sessionData.lastExitCode = command.exitCode
  sessionData.lastState = command.state
  sessionData.lastStartTime = command.startTime
  sessionData.lastEndTime = command.endTime
  sessionData.lastError = command.error
}

// When new command starts:
function onCommandStart(sessionData) {
  // Clear previous results
  sessionData.lastCommand = null
  sessionData.lastOutput = null
  sessionData.lastExitCode = null
  sessionData.lastState = null
  sessionData.lastStartTime = null
  sessionData.lastEndTime = null
  sessionData.lastError = null
}

// When polling:
function getLastCommandState(sessionData) {
  if (!sessionData.lastCommand) {
    return { error: "No long-running command in session" }
  }

  return {
    isRunning: false,
    command: sessionData.lastCommand,
    startTime: sessionData.lastStartTime,
    elapsedTime: sessionData.lastEndTime - sessionData.lastStartTime,
    currentOutput: sessionData.lastOutput
  }
}
```

## Implementation Tasks
[ ] **Extend SessionData** - Add result fields to existing interface
[ ] **Store on Completion** - Set session fields when command completes
[ ] **Clear on Start** - Reset fields when new command starts
[ ] **Update Polling API** - Return session field values

### Task Details
1. **Extend SessionData Interface**
   - Add 6 simple optional fields to existing SessionData
   - No new classes or complex structures needed

2. **Store Results on Completion**
   - In existing command completion handler, set session fields
   - Copy command result data to session
   - No separate storage system

3. **Clear Results on New Command**
   - In existing command start handler, null out result fields
   - Simple field reset, no complex cleanup

4. **Update Polling API**
   - Modify ssh_get_long_running_command_state to check session fields
   - Return simple response based on session data

## Testing Requirements
### Unit Tests
[ ] Session fields set correctly on completion
[ ] Session fields cleared on new command
[ ] Polling returns session field values
[ ] No command case handled properly

### Test Cases
```javascript
describe('Result Persistence', () => {
  test('Command results stored in session', () => {
    // Complete a command
    // Verify session.lastCommand, lastOutput, etc. are set
  })

  test('Results cleared on new command', () => {
    // Store results, start new command
    // Verify all lastCommand* fields are null
  })

  test('Polling returns session results', () => {
    // Store results, poll
    // Verify response contains session field values
  })
})
```

## Dependencies
### Internal Dependencies
- Existing SessionData structure
- Existing command completion handlers
- Existing polling API implementation

### External Dependencies
- None (uses existing session management)

## Definition of Done
[ ] SessionData interface extended with result fields
[ ] Command completion stores results in session
[ ] New command clears previous results
[ ] Polling API returns session field values
[ ] Unit tests passing
[ ] No complex storage system created

## Notes
- Keep it simple - just session fields, no separate storage
- Reuse existing session management infrastructure
- No memory management complexity needed
- Results automatically cleared on next command