# Story 02: Browser Command Emulation

## User Story

**As a** Villenele testing framework  
**I want** to execute browser-initiated commands via WebSocket terminal_input messages  
**So that** I can test the complete browser command pathway and validate terminal behavior from the user perspective

## Acceptance Criteria

### WebSocket Message Routing

**AC 2.1**: Command-level browser emulation (not character-by-character)
- **Given** a command with `{initiator: 'browser', command: 'pwd'}`
- **When** Villenele executes the command
- **Then** it should send a complete command string via WebSocket terminal_input message
- **And** should NOT send individual characters or keystrokes to emulate typing
- **And** should emulate browser's complete command submission behavior
- **And** the message should follow the format: `{type: 'terminal_input', sessionName: 'test-session', command: 'pwd', commandId: 'generated-id'}`

**AC 2.2**: WebSocket message structure validation
- **Given** a browser command execution
- **When** the WebSocket message is constructed
- **Then** it should include all required fields: type, sessionName, command, commandId
- **And** the commandId should be unique for each command execution
- **And** the sessionName should match the test configuration session

**AC 2.3**: MCP command JSON-RPC preservation
- **Given** a command with `{initiator: 'mcp-client', command: 'date'}`
- **When** Villenele executes the command  
- **Then** it should use the existing stdin JSON-RPC communication path
- **And** maintain identical behavior to current MCP command execution
- **And** not interfere with WebSocket communication

**AC 2.4**: Mixed command session context maintenance
- **Given** mixed browser and MCP commands in sequence
- **When** executed by Villenele
- **Then** session context and SSH connection should be maintained throughout
- **And** command tracking should work correctly for both command types
- **And** no session state should be lost between different command initiators

### Browser Command Execution Flow

**AC 2.5**: Browser command response capture
- **Given** browser command `{initiator: 'browser', command: 'pwd'}`
- **When** sent via WebSocket terminal_input message
- **Then** Villenele should capture the terminal response via WebSocket message monitoring
- **And** the response should include the command execution output
- **And** the response should be integrated into concatenatedResponses for test validation

**AC 2.6**: Browser command completion detection
- **Given** a browser command execution via WebSocket
- **When** waiting for command completion
- **Then** Villenele should detect completion through WebSocket response messages
- **And** distinguish between command output and completion signal
- **And** proceed to next command only after confirmed completion

### Protocol-Specific Communication

**AC 2.7**: WebSocket connection validation
- **Given** browser command execution attempt
- **When** WebSocket connection is not available
- **Then** Villenele should fail gracefully with error: "WebSocket connection required for browser commands"
- **And** provide guidance for establishing WebSocket connection
- **And** not attempt to fall back to JSON-RPC for browser commands

**AC 2.8**: Command ID generation and tracking
- **Given** multiple browser commands in sequence
- **When** each command is executed
- **Then** each should receive a unique commandId
- **And** command IDs should be trackable for response correlation
- **And** response matching should work correctly with generated IDs

### Integration with Command State Synchronization

**AC 2.9**: Browser command buffer integration
- **Given** browser command execution via Villenele
- **When** the command is sent through WebSocket terminal_input
- **Then** it should be properly tracked in the SSH connection manager's browser command buffer
- **And** the command should have source attribution as 'user'
- **And** subsequent MCP commands should be gated appropriately if browser commands are in buffer

**AC 2.10**: Command gating scenario testing capability
- **Given** test configuration:
```typescript
postWebSocketCommands: [
  {initiator: 'mcp-client', command: 'pwd'},
  {initiator: 'browser', command: 'ls'},  
  {initiator: 'mcp-client', command: 'whoami'}  // Should be gated
]
```
- **When** Villenele executes the sequence
- **Then** the final MCP command should be blocked by Command State Synchronization
- **And** Villenele should receive the BROWSER_COMMANDS_EXECUTED error
- **And** the error should include the complete browser command results

### Error Handling and Recovery

**AC 2.11**: WebSocket communication error handling
- **Given** browser command execution attempt
- **When** WebSocket communication fails mid-execution
- **Then** Villenele should capture the error and provide diagnostic information
- **And** clearly indicate the failure was in WebSocket communication
- **And** not proceed to subsequent commands until connection is restored

**AC 2.12**: Invalid WebSocket response handling
- **Given** browser command sent via WebSocket
- **When** response format is invalid or corrupted
- **Then** Villenele should handle gracefully with timeout fallback
- **And** log specific details about the response parsing failure
- **And** provide sufficient information for debugging WebSocket message issues

## Definition of Done

- [x] ✅ Browser commands route correctly via WebSocket terminal_input messages
- [x] ✅ MCP commands continue using existing JSON-RPC path without changes
- [x] ✅ WebSocket message format matches terminal infrastructure requirements
- [x] ✅ Browser command responses captured and integrated into test results
- [x] ✅ Mixed command sequences maintain proper session context
- [x] ✅ Integration with Command State Synchronization Epic preserved and testable
- [x] ✅ Error handling provides clear diagnostics for WebSocket communication issues
- [x] ✅ Command tracking and response correlation working correctly

## Technical Implementation Notes

### WebSocket Message Format
```javascript
{
  type: 'terminal_input',
  sessionName: string,    // From test configuration
  command: string,        // From command parameter
  commandId: string       // Generated unique identifier
}
```

### Response Monitoring Strategy
- Subscribe to WebSocket messages during browser command execution
- Filter responses by commandId correlation
- Detect completion through command prompt return or specific completion markers
- Integrate captured output into existing concatenatedResponses structure

### Command State Sync Integration Testing
- Browser commands executed via Villenele should trigger identical browser command buffer behavior
- Enable testing of BROWSER_COMMANDS_EXECUTED error scenarios
- Validate that Command State Synchronization Epic functionality works with Villenele-emulated browser commands

This story provides the core browser command execution capability that enables comprehensive testing of terminal interaction scenarios and Command State Synchronization functionality.