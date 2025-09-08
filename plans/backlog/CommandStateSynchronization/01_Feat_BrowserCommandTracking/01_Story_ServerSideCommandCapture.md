# Story: Server-Side Command Capture

**As a** system administrator
**I want** browser terminal commands captured server-side  
**So that** the system maintains awareness of all user-initiated commands

## Acceptance Criteria

### Given/When/Then Scenarios

#### Scenario 1: Basic Command Capture
- [ ] **Given** user has browser terminal session open
- [ ] **When** user types and executes `ls -la` command  
- [ ] **Then** server captures command string "ls -la" in session buffer
- [ ] **And** command executes normally with expected output
- [ ] **And** user sees no difference in terminal experience

#### Scenario 2: Multiple Command Sequence
- [ ] **Given** browser command buffer is empty
- [ ] **When** user executes sequence: `pwd`, `whoami`, `date`
- [ ] **Then** buffer contains array: ["pwd", "whoami", "date"]
- [ ] **And** commands are stored in execution order
- [ ] **And** all commands complete successfully

#### Scenario 3: Complex Command Capture
- [ ] **Given** user wants to execute complex command
- [ ] **When** user types `find /home -name "*.txt" | grep -v temp | head -10`
- [ ] **Then** server captures complete command string exactly as typed
- [ ] **And** command executes with full pipeline functionality
- [ ] **And** buffer contains exact command string including pipes and quotes

#### Scenario 4: Session Isolation
- [ ] **Given** two different SSH sessions: "session-a" and "session-b"  
- [ ] **When** session-a executes `ls` and session-b executes `pwd`
- [ ] **Then** session-a buffer contains only ["ls"]
- [ ] **And** session-b buffer contains only ["pwd"]  
- [ ] **And** commands do not cross-contaminate between sessions

#### Scenario 5: Buffer Persistence
- [ ] **Given** user has executed commands in browser terminal
- [ ] **When** commands complete and user continues working
- [ ] **Then** command buffer persists all executed commands
- [ ] **And** buffer remains accessible for later notification
- [ ] **And** buffer is not automatically cleared or expired

## Implementation Requirements

### WebSocket Integration
```
PSEUDOCODE WebSocket Message Handler:
function handleTerminalInputMessage(sessionName, messageData) {
    extractCommandString = parseWebSocketMessage(messageData)
    sessionBuffer = getOrCreateSessionBuffer(sessionName)
    sessionBuffer.add(extractCommandString)
    proceedWithNormalExecution(sessionName, extractCommandString)
}
```

### SessionData Enhancement
```
PSEUDOCODE Buffer Management:
interface SessionData {
    browserCommandBuffer: array of strings
    bufferCreatedTimestamp: number
}

function addCommandToBuffer(sessionName, commandString) {
    sessionData = getSessionData(sessionName)
    sessionData.browserCommandBuffer.push(commandString)
    if (!sessionData.bufferCreatedTimestamp) {
        sessionData.bufferCreatedTimestamp = currentTimestamp()
    }
}
```

## Testing Strategy

### Unit Test Cases
1. **Command Extraction**: Verify correct command parsing from WebSocket messages
2. **Buffer Addition**: Test command appending to session-specific arrays  
3. **Session Isolation**: Validate commands don't leak between sessions
4. **Complex Commands**: Test capture of pipes, quotes, and special characters

### Integration Test Cases
1. **WebSocket Flow**: End-to-end message handling with actual WebSocket
2. **SSH Execution**: Verify normal command execution after capture
3. **Multiple Sessions**: Concurrent session command isolation
4. **Buffer Persistence**: Command retention across session lifecycle

### E2E Test Cases (Villenele Framework)
1. **Real Browser Terminal**: Actual browser command execution and verification
2. **Command Sequence**: Multiple commands with buffer state validation  
3. **Session Management**: Multi-session browser terminal testing
4. **Complex Command Types**: Interactive commands, long-running processes

## Definition of Done

- ✅ **Working Software**: Users can execute browser terminal commands normally
- ✅ **Command Tracking**: All commands captured in server-side buffer  
- ✅ **Session Isolation**: No command cross-contamination between sessions
- ✅ **Zero User Impact**: Browser terminal experience unchanged
- ✅ **E2E Tests Pass**: Villenele validation confirms functionality
- ✅ **Integration Ready**: Buffer accessible for MCP gating features

This story establishes the foundational command capture mechanism required for all subsequent state synchronization features.