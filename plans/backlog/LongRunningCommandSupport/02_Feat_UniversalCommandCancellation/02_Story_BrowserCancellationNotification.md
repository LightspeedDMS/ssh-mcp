# Story: Browser Cancellation Notification

## Story Overview
**Story ID:** 02_Story_BrowserCancellationNotification
**Feature:** 02_Feat_UniversalCommandCancellation
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning
**Story Points:** 1
**Created:** 2025-09-15

## User Story
**As a** browser terminal user
**I want** to receive immediate notification when my command is cancelled by an MCP client
**So that** I understand why my command stopped and can take appropriate action

## Story Description
Implement simple browser notification that sends the exact message "[CANCELLED] Command terminated by MCP client" via WebSocket when a command is cancelled. The message appears in the terminal output immediately.

## Acceptance Criteria
[x] **WebSocket Notification** - Send cancellation message
[x] **Terminal Display** - Show "[CANCELLED] Command terminated by MCP client"
[x] **Immediate Delivery** - Message appears within 100ms

### Detailed Acceptance Criteria
```gherkin
Feature: Browser Cancellation Notification
  Background:
    Given a browser is connected to session "user-session"
    And a command is running in the terminal

  Scenario: Browser receives cancellation notification
    Given browser user executed "sleep 120"
    When an MCP client cancels the command
    Then the browser receives WebSocket message within 100ms
    And the message type is "command_cancelled"
    And the message contains "[CANCELLED] Command terminated by MCP client"

  Scenario: Terminal displays cancellation message
    When a cancellation notification is received
    Then the terminal displays:
      """
      [CANCELLED] Command terminated by MCP client
      """
    And the terminal prompt is restored

  Scenario: Multiple browsers receive notification
    Given 3 browsers are connected to the same session
    When the command is cancelled
    Then all 3 browsers receive the notification
    And notifications arrive within 100ms
    And all browsers show consistent messages

  Scenario: Cancellation during command execution
    Given a command "sleep 65" is running
    When cancellation occurs
    Then output streaming stops immediately
    And cancellation message appears after last output
    And no further output is displayed
    And terminal becomes interactive again

  Scenario: Browser reconnection after cancellation
    Given a command was cancelled while browser was disconnected
    When the browser reconnects
    Then the terminal history shows "[CANCELLED] Command terminated by MCP client"
    And the session state shows "cancelled"

  Scenario: Cancellation of sleep command
    Given a command "sleep 120" is running
    When the browser receives cancellation notification
    Then previous output remains visible
    And cancellation message appears below output
    And partial results are clearly marked
    And user can scroll to see all output
```

## Technical Design
### WebSocket Message
```typescript
// Simple text message sent via WebSocket:
const cancellationMessage = "[CANCELLED] Command terminated by MCP client\r\n"
```

### Notification Handler
```pseudocode
function sendCancellationToBrowser(session) {
  // Get browser WebSocket for session
  browserWs = getBrowserWebSocket(session.name)

  if (browserWs && browserWs.readyState === OPEN) {
    // Send exact cancellation message
    browserWs.send("[CANCELLED] Command terminated by MCP client\r\n")
  }
}

  }
```

### Terminal Display Formatter
```pseudocode
function formatCancellationMessage(session) {
  // Simple cancellation message
  return "[CANCELLED] Command terminated by MCP client\r\n"
}

function restorePrompt(session) {
  // Restore the session prompt
  promptLine = `[${session.username}@${session.hostname} ${session.cwd}]$ `
  return `\r\n${promptLine}`
}
```

### Browser Terminal Handler
```javascript
// Browser-side JavaScript
function handleWebSocketMessage(message) {
  const data = message.data

  if (data.includes('[CANCELLED]')) {
    handleCancellation(data)
  }
}

function handleCancellation(cancellationMessage) {
  // Write cancellation message to terminal
  terminal.write(cancellationMessage)

  // Restore prompt
  const prompt = restorePrompt(session)
  terminal.write(prompt)

  // Reset terminal state
  terminalState = 'ready'
  currentCommand = null
}
```

## Implementation Tasks
[ ] **WebSocket Protocol** - Define cancellation message format
[ ] **Notification Manager** - Implement broadcast system
[ ] **Terminal Formatter** - Create visual formatting
[ ] **Browser Handler** - Implement client-side handling
[ ] **Connection Tracking** - Manage browser connections
[ ] **Delivery Confirmation** - Ensure notification delivery

### Task Details
1. **WebSocket Message Design**
   - Define message schema
   - Version the protocol
   - Add sequence numbers
   - Include metadata

2. **Server-Side Broadcasting**
   - Track connected browsers
   - Implement broadcast logic
   - Handle disconnected clients
   - Add retry mechanism

3. **Terminal Formatting**
   - Send simple cancellation message
   - Restore terminal prompt

4. **Browser Integration**
   - Parse WebSocket messages
   - Update terminal display
   - Restore interactivity
   - Handle edge cases

5. **Connection Management**
   - Track WebSocket connections
   - Handle reconnections
   - Clean up stale connections
   - Monitor connection health

6. **Testing Infrastructure**
   - Mock WebSocket connections
   - Simulate cancellations
   - Verify message delivery
   - Test display formatting

## Testing Requirements
### Unit Tests
[ ] Message formatting correctness
[ ] Connection tracking accuracy
[ ] Broadcast logic validation
[ ] Terminal display formatting
[ ] Error handling robustness

### Integration Tests
[ ] End-to-end notification flow
[ ] Multiple browser scenarios
[ ] Reconnection handling
[ ] Message delivery guarantees

### Test Cases
```javascript
describe('Browser Cancellation Notification', () => {
  test('Single browser receives notification', async () => {
    // Connect browser
    // Cancel command via MCP
    // Verify notification received
    // Check message content
  })

  test('Multiple browsers notified', async () => {
    // Connect 3 browsers
    // Cancel command
    // Verify all receive notification
    // Check timing <100ms
  })

  test('Terminal display formatting', async () => {
    // Receive cancellation
    // Verify terminal output
    // Check color coding
    // Verify prompt restoration
  })

  test('Notification during streaming', async () => {
    // Start output streaming
    // Cancel mid-stream
    // Verify stream stops
    // Check notification placement
  })

  test('Reconnection shows history', async () => {
    // Cancel while disconnected
    // Reconnect browser
    // Verify cancellation in history
    // Check state consistency
  })
})
```

## Dependencies
### Internal Dependencies
- MCP cancellation capability (Story 01)
- WebSocket infrastructure
- Terminal display system
- Session management

### External Dependencies
- WebSocket library
- Terminal emulator (xterm.js)
- Browser JavaScript runtime

## Definition of Done
[ ] All acceptance criteria met
[ ] WebSocket protocol defined
[ ] Notification system working
[ ] Terminal display formatted
[ ] Browser handler implemented
[ ] All browsers notified
[ ] Unit tests passing
[ ] Integration tests complete
[ ] Visual testing validated
[ ] Documentation updated
[ ] Code review approved

## Risk Assessment
### Technical Risks
1. **Message Delivery Failure**
   - Risk: Browsers don't receive notification
   - Mitigation: Delivery confirmation and retry

2. **Display Corruption**
   - Risk: Terminal display becomes garbled
   - Mitigation: Careful ANSI code handling

3. **Race Conditions**
   - Risk: Output after cancellation
   - Mitigation: Strict ordering enforcement

## Performance Criteria
- Notification latency: <100ms
- Message delivery: <50ms

## Notes
- Simple WebSocket message delivery
- Fixed cancellation message format