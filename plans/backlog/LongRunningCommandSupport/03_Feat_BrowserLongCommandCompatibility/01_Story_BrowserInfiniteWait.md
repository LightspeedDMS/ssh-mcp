# Story: Browser Infinite Wait

## Story Overview
**Story ID:** 01_Story_BrowserInfiniteWait
**Feature:** 03_Feat_BrowserLongCommandCompatibility
**Epic:** LongRunningCommandSupport
**Priority:** High
**Status:** Planning
**Story Points:** 1
**Created:** 2025-09-15

## User Story
**As a** browser terminal user
**I want** my long-running commands to execute without any timeout restrictions
**So that** I can perform system maintenance, updates, and monitoring tasks through the web interface just like a native SSH terminal

## Story Description
Verify that browser terminals continue waiting forever for long-running commands with no timeout changes. The async mode transition at 60 seconds should be completely transparent to the browser - no disconnections, no notifications, just continued output streaming. Browser receives cancellation notifications when MCP cancels.

## Acceptance Criteria
[x] **No Timeout Changes** - Browser waits forever as before
[x] **Transparent Async** - 55-second transition invisible to browser
[x] **Cancellation Reception** - Shows "[CANCELLED] Command terminated by MCP client"
[x] **Output Continues** - Real-time streaming unchanged

### Detailed Acceptance Criteria
```gherkin
Feature: Browser Infinite Wait
  Background:
    Given I'm connected to the browser terminal
    And the session "browser-session" is active

  Scenario: Execute command without timeout
    When I execute "sleep 120"
    Then the command runs for its full duration
    And no timeout occurs at 15 seconds
    And no timeout occurs at 60 seconds
    And the command completes after 120 seconds

  Scenario: Transparent async mode integration
    Given I execute "sleep 120 && echo 'Done'"
    When 60 seconds elapse
    Then the terminal shows no mode change indication
    And output streaming continues uninterrupted
    And no reconnection is required
    And the async transition happens silently in background

  Scenario: Simple command execution
    When I execute "sleep 65"
    Then the command runs normally
    And completes after 65 seconds

  Scenario: Browser receives MCP cancellation
    Given command "sleep 120" is running
    When an MCP client cancels the command
    Then "[CANCELLED] Command terminated by MCP client" appears
    And the command stops producing output
    And the prompt returns
    And terminal becomes interactive again

  Scenario: No visual changes for async mode
    Given a command transitions to async at 60 seconds
    Then no visual indicators change
    And no notifications appear
    And output continues normally
    And browser is unaware of the transition

  Scenario: Reconnection to running command
    Given I started "sleep 120" and closed browser
    When I reconnect to the same session
    Then new output continues streaming
    And I can still see the session

  Scenario: Simple long command test
    When I execute "sleep 120"
    Then the browser waits for 2 minutes
    And no timeout occurs at 60 seconds
    And the command completes normally

  Scenario: Multiple sleep commands sequence
    When I execute "sleep 60"
    And it completes successfully
    And I execute "sleep 65"
    Then both commands run to completion
    And no interference between commands occurs
```

## Technical Design
### Key Requirements
```pseudocode
// When command exceeds 60 seconds:
function handleAsyncTransition(session) {
  // MCP client gets async notification
  sendAsyncNotificationToMCP()

  // Browser gets NOTHING - continues waiting
  // No WebSocket changes
  // No timeout modifications
  // Output continues streaming
}

// When MCP cancels:
function handleMCPCancellation(session) {
  // Send to browser WebSocket
  browserWs.send("[CANCELLED] Command terminated by MCP client\r\n")
}
```

### Simple Implementation
```pseudocode
// Existing WebSocket streaming already works
// No new code needed - just ensure:
// 1. No new timeouts added
// 2. WebSocket continues during async mode
// 3. Cancellation message delivered

function streamOutput(session, data) {
  // Send via WebSocket
  if (session.wsConnection.isOpen()) {
    session.wsConnection.send(data)
  }
}

function handleMCPCancellation(session) {
  // Send cancellation message to browser
  session.wsConnection.send("[CANCELLED] Command terminated by MCP client\r\n")
}
```


## Implementation Tasks
[ ] **WebSocket Enhancement** - Maintain persistent connections
[ ] **Stream Bridge** - Connect async to browser streaming
[ ] **Cancellation Handler** - Browser Ctrl+C support
[ ] **Reconnection Logic** - Resume monitoring after disconnect
[ ] **Memory Management** - Efficient output buffering

### Task Details
1. **WebSocket Persistence**
   - Implement keepalive mechanism
   - Handle connection drops gracefully
   - Auto-reconnect with exponential backoff
   - Preserve session state

2. **Output Streaming**
   - Real-time data delivery
   - Preserve ANSI sequences
   - Optimize for high-throughput
   - Manage backpressure


4. **Browser Interaction**
   - Basic terminal display
   - Output streaming

5. **Reconnection Support**
   - Session persistence
   - Output buffer replay
   - State restoration
   - Seamless resumption


## Testing Requirements
### Unit Tests
[ ] Stream bridge functionality
[ ] Reconnection logic
[ ] Memory management
[ ] Cancellation handling

### Integration Tests
[ ] Long duration commands
[ ] High output volume
[ ] Multiple reconnections
[ ] Browser compatibility

### Test Cases
```javascript
describe('Browser Infinite Wait', () => {
  test('Sleep 120 runs without timeout', async () => {
    // Execute sleep 120
    // Verify no timeout at 15s
    // Verify no timeout at 60s
    // Confirm completion after 120 seconds
  })

  test('Sleep 65 transparent async transition', async () => {
    // Execute sleep 65
    // Monitor for mode change indicators
    // Verify seamless execution
    // Check no user-visible changes
  })

  test('Sleep command cancellation', async () => {
    // Start sleep 120
    // Send cancellation
    // Verify termination
    // Check prompt restoration
  })


  test('Reconnection handling', async () => {
    // Start command
    // Disconnect browser
    // Reconnect
    // Verify state restoration
    // Check output continuity
  })
})
```

## Dependencies
### Internal Dependencies
- WebSocket server infrastructure
- Session management system
- Terminal emulator integration
- Command execution pipeline

### External Dependencies
- xterm.js terminal emulator
- WebSocket client library
- Browser DOM APIs
- Performance monitoring APIs

## Definition of Done
[ ] All acceptance criteria met
[ ] Commands run indefinitely
[ ] Output streams in real-time
[ ] Async mode transparent
[ ] Ctrl+C working reliably
[ ] Reconnection seamless
[ ] Memory usage stable
[ ] All tests passing
[ ] Browser compatibility verified
[ ] Documentation complete
[ ] Code review approved

## Risk Assessment
### Technical Risks
1. **WebSocket Stability**
   - Risk: Connection drops during long operations
   - Mitigation: Robust reconnection logic

2. **Browser Memory**
   - Risk: Large outputs causing memory issues
   - Mitigation: Virtual scrolling and output limits

3. **UI Responsiveness**
   - Risk: Heavy output affecting browser performance
   - Mitigation: Render throttling and optimization

## Performance Criteria
- Output latency: <100ms
- Cancellation response: <1 second

## Notes
- Simple browser terminal display
- No timeout changes needed
- Transparent async mode transition