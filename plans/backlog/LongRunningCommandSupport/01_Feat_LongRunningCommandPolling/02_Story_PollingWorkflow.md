# Story: Polling Workflow

## Story Overview
**Story ID:** 02_Story_PollingWorkflow
**Feature:** 01_Feat_LongRunningCommandPolling
**Epic:** LongRunningCommandSupport
**Priority:** Critical
**Status:** Planning
**Story Points:** 2
**Created:** 2025-09-15

## User Story
**As a** MCP client developer
**I want** to poll for the state and output of long-running commands
**So that** I can monitor progress and retrieve results without blocking my application

## Story Description
Implement the simple polling API that allows MCP clients to retrieve the current state and output of commands running in async mode. This includes the new `ssh_get_long_running_command_state` API endpoint that reads from session fields.

## Acceptance Criteria
[x] **API Implementation** - ssh_get_long_running_command_state endpoint functional
[x] **State Retrieval** - Read state from session fields
[x] **Output Return** - Return accumulated output
[x] **Performance** - Response time <50ms for polling requests
[x] **Error Handling** - Invalid sessions handled gracefully

### Detailed Acceptance Criteria
```gherkin
Feature: Polling Workflow
  Background:
    Given an SSH session "monitor-session" is established
    And a command "sleep 120" is running in async mode

  Scenario: Poll for running command state
    When I call "ssh_get_long_running_command_state" with:
      | sessionName | monitor-session |
    Then I receive a response within 50ms
    And the response contains:
      | field         | value                           |
      | state         | "running"                       |
      | sessionName   | "monitor-session"               |
      | command       | "sleep 120"                     |
      | startTime     | <timestamp>                     |
      | output        | <accumulated_output>            |

  Scenario: Poll for completed command
    Given the command has completed successfully
    When I poll for the state
    Then the response includes:
      | field         | value                           |
      | state         | "completed"                     |
      | exitCode      | 0                              |
      | endTime       | <timestamp>                     |
      | output        | ""                             |

  Scenario: Output retrieval
    Given a command "sleep 65" is running
    When I poll for state
    Then I receive the current state
    And output shows empty for sleep command

  Scenario: Poll with invalid session
    When I poll with non-existent session "invalid-session"
    Then I receive an error response
    And the error indicates "Session not found"

  Scenario: Poll after command failure
    Given a command has failed
    When I poll for the state
    Then the response shows:
      | field     | value                |
      | state     | "failed"            |
      | exitCode  | 1                   |
      | error     | "Command failed"    |

  Scenario: Concurrent polling requests
    When 10 clients poll simultaneously
    Then all receive consistent state information
    And response times remain under 50ms
    And no data corruption occurs
```

## Technical Design
### API Specification
```typescript
interface GetLongRunningCommandStateRequest {
  sessionName: string
}

interface GetLongRunningCommandStateResponse {
  success: boolean
  state: 'running' | 'completed' | 'failed' | 'cancelled'
  command: string
  sessionName: string
  startTime: number
  endTime?: number
  output: string
  exitCode?: number
  error?: string
}
```

### Implementation Components
1. **Simple Polling Handler**
   ```pseudocode
   function handleGetState(request) {
     // Get session by name
     session = getSession(request.sessionName)
     if (!session) return errorResponse('Session not found')

     // Check if command exists
     if (!session.lastCommand) {
       return errorResponse('No long-running command in session')
     }

     // Build response from session fields
     return {
       success: true,
       state: session.lastState,
       command: session.lastCommand,
       sessionName: session.name,
       startTime: session.lastStartTime,
       endTime: session.lastEndTime,
       output: session.lastOutput || '',
       exitCode: session.lastExitCode,
       error: session.lastError
     }
   }
   ```

2. **Session Field Updates**
   ```pseudocode
   // During command execution:
   function updateSessionOutput(session, newData) {
     session.lastOutput += newData
   }

   // On command completion:
   function completeCommand(session, exitCode) {
     session.lastState = exitCode === 0 ? 'completed' : 'failed'
     session.lastExitCode = exitCode
     session.lastEndTime = Date.now()
   }
   ```

## Implementation Tasks
[ ] **API Endpoint** - Create ssh_get_long_running_command_state handler
[ ] **State Retrieval** - Read from session fields
[ ] **Output Collection** - Accumulate output in session.lastOutput
[ ] **Error Handling** - Handle invalid sessions

### Task Details
1. **API Endpoint Implementation**
   - Define simple request/response types
   - Create MCP protocol handler
   - Validate sessionName parameter

2. **State Retrieval**
   - Read session.last* fields
   - Return current values
   - Handle missing fields gracefully

3. **Error Handling**
   - Session not found
   - No command in session
   - Return appropriate error messages

## Testing Requirements
### Unit Tests
[ ] State retrieval from session
[ ] Output accumulation
[ ] Error handling for invalid sessions

### Integration Tests
[ ] Complete polling workflow
[ ] Progressive output retrieval
[ ] Multiple client polling
[ ] Performance under load

### Test Cases
```javascript
describe('Polling Workflow', () => {
  test('Poll sleep 120 command', async () => {
    // Start sleep 120
    // Poll after async notification
    // Verify state = 'running'
    // Check response time <50ms
  })

  test('Poll completed sleep 65', async () => {
    // Execute sleep 65
    // Wait for completion
    // Poll for final state
    // Verify state = 'completed' and exitCode = 0
  })

  test('Invalid session polling', async () => {
    // Poll with non-existent sessionName
    // Verify error response
    // Check error message
  })

  test('Invalid session handling', async () => {
    // Poll with invalid sessionName
    // Verify error response
    // Check helpful error message
  })
})
```

## Dependencies
### Internal Dependencies
- Async mode transition (Story 01)
- Session management system
- Command execution tracking
- Output stream handling

### External Dependencies
- Performance monitoring tools
- Serialization framework

## Definition of Done
[ ] All acceptance criteria met
[ ] API endpoint fully functional
[ ] Response time <50ms achieved
[ ] Unit tests comprehensive
[ ] Integration tests passing
[ ] Documentation complete
[ ] Performance benchmarks met
[ ] Error scenarios handled
[ ] Code review approved

## Risk Assessment
### Technical Risks
1. **Output Buffer Size**
   - Risk: Large outputs exceeding memory
   - Mitigation: Simple session field storage

2. **Polling Storm**
   - Risk: Excessive polling overloading system
   - Mitigation: Rate limiting per client

3. **State Inconsistency**
   - Risk: State changes during poll response
   - Mitigation: Snapshot isolation

## Performance Criteria
- Poll response time: <50ms
- API response time: <100ms

## Notes
- Simple session field storage for state and output
- Basic polling API for command state retrieval