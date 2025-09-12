# Story 05: Command Interruption Emulation

## User Story

**As a** Villenele test developer  
**I want** timeout-based command cancellation for both browser and MCP commands  
**So that** I can test command interruption scenarios, validate cancellation behavior, and ensure long-running commands can be terminated appropriately

## Acceptance Criteria

### Basic Timeout-Based Cancellation

**AC 5.1**: Browser command cancellation after timeout with sleep
- **Given** browser command with cancellation: `{initiator: 'browser', command: 'sleep 30', cancel: true, waitToCancelMs: 3000}`
- **When** Villenele executes the command
- **Then** command should be sent via WebSocket terminal_input message
- **And** after 3000ms, cancellation should be triggered via WebSocket sendTerminalSignal(SIGINT)
- **And** sleep command should be interrupted with ^C before 30 seconds complete
- **And** cancellation should be captured in concatenatedResponses showing interrupted sleep

**AC 5.2**: MCP command cancellation after timeout
- **Given** MCP command with cancellation: `{initiator: 'mcp-client', command: 'sleep 15', cancel: true, waitToCancelMs: 5000}`
- **When** Villenele executes the command
- **Then** command should be sent via JSON-RPC stdin
- **And** after 5000ms, cancellation should be triggered via ssh_cancel_command tool
- **And** command should be interrupted using MCP cancellation mechanism
- **And** cancellation result should be captured in response

**AC 5.3**: Default cancellation timeout behavior
- **Given** command with cancel enabled but no timeout specified: `{initiator: 'browser', command: 'sleep 20', cancel: true}`
- **When** Villenele processes the configuration
- **Then** default waitToCancelMs should be set to 10000 (10 seconds)
- **And** cancellation should trigger after 10 seconds
- **And** command should be interrupted appropriately

### Protocol-Specific Cancellation Mechanisms

**AC 5.4**: WebSocket SIGINT signal cancellation
- **Given** browser command `{initiator: 'browser', command: 'find . -name "*.log"', cancel: true, waitToCancelMs: 2000}`
- **When** timeout period expires
- **Then** Villenele should send WebSocket message: `{type: 'terminal_signal', sessionName: 'test-session', signal: 'SIGINT'}`
- **And** terminal should receive interrupt signal
- **And** command should terminate with interrupt indication: `^C`
- **And** command prompt should return after interruption

**AC 5.5**: MCP ssh_cancel_command cancellation
- **Given** MCP command `{initiator: 'mcp-client', command: 'find . -name "*.ts" -exec grep -l "export" {} \;', cancel: true, waitToCancelMs: 4000}`
- **When** timeout period expires
- **Then** Villenele should call ssh_cancel_command tool with session name
- **And** MCP server should cancel the running command
- **And** cancellation result should indicate successful interruption
- **And** session should remain active for subsequent commands

**AC 5.6**: Mixed cancellation scenario execution
- **Given** sequence with mixed cancellations:
```typescript
postWebSocketCommands: [
  {initiator: 'browser', command: 'pwd'},                           // No cancel
  {initiator: 'browser', command: 'sleep 10', cancel: true, waitToCancelMs: 2000}, // Browser cancel
  {initiator: 'mcp-client', command: 'sleep 10', cancel: true, waitToCancelMs: 3000}, // MCP cancel  
  {initiator: 'browser', command: 'whoami'}                         // No cancel
]
```
- **When** Villenele executes the complete sequence
- **Then** first command should complete normally
- **And** second command should be cancelled via WebSocket after 2 seconds
- **And** third command should be cancelled via MCP after 3 seconds
- **And** fourth command should execute normally after cancellations

### Cancellation Timing and Precision

**AC 5.7**: Cancellation timing accuracy
- **Given** command with `waitToCancelMs: 5000` (5 seconds)
- **When** Villenele executes command with cancellation
- **Then** cancellation should occur within 5000ms ± 500ms tolerance
- **And** timing should be measured from command start, not configuration time
- **And** cancellation precision should be consistent across multiple executions

**AC 5.8**: Command completion before timeout
- **Given** fast command with cancellation: `{initiator: 'browser', command: 'echo "quick"', cancel: true, waitToCancelMs: 10000}`
- **When** command completes naturally before timeout
- **Then** cancellation timer should be cleared
- **And** no cancellation signal should be sent
- **And** command should complete normally with expected output: `quick`

**AC 5.9**: Concurrent cancellation handling
- **Given** multiple commands with different cancellation timers executing simultaneously
- **When** different cancellation timeouts expire at overlapping times  
- **Then** each command should be cancelled independently
- **And** cancellation signals should not interfere with each other
- **And** session state should remain stable across concurrent cancellations

### Cancellation Response Validation

**AC 5.10**: Browser cancellation response capture
- **Given** browser command cancelled after timeout
- **When** WebSocket SIGINT signal is sent
- **Then** concatenatedResponses should contain command echo: `sleep 30`
- **And** contain partial command output (if any produced before cancellation)
- **And** contain interrupt indicator: `^C`
- **And** contain returned command prompt: `[${process.env.USER}@localhost ${process.env.PWD}]$`

**AC 5.11**: MCP cancellation response capture
- **Given** MCP command cancelled via ssh_cancel_command
- **When** cancellation is executed
- **Then** concatenatedResponses should contain command execution start
- **And** contain cancellation confirmation from MCP server
- **And** contain any partial output produced before cancellation
- **And** maintain response format consistency for validation

**AC 5.12**: Post-cancellation session validation
- **Given** commands that have been cancelled via timeout mechanisms
- **When** subsequent commands are executed in same session
- **Then** SSH session should remain active and functional
- **And** working directory should be preserved correctly
- **And** environment state should be maintained across cancellations
- **And** no session corruption should occur from interruptions

### Error Handling and Edge Cases

**AC 5.13**: Cancellation failure handling
- **Given** command with cancellation timeout
- **When** cancellation mechanism fails (WebSocket disconnection, MCP error)
- **Then** Villenele should detect cancellation failure
- **And** log specific error: "Command cancellation failed: [specific reason]"
- **And** continue with next command or fail gracefully based on configuration
- **And** provide diagnostic information for troubleshooting cancellation issues

**AC 5.14**: Invalid timeout value handling
- **Given** command with invalid timeout: `{initiator: 'browser', command: 'pwd', cancel: true, waitToCancelMs: 0}`
- **When** Villenele validates the configuration
- **Then** validation should reject zero or negative timeout values
- **And** provide error: "waitToCancelMs must be positive value >= 1000"
- **And** suggest minimum reasonable timeout value
- **And** prevent command execution with invalid timeout

**AC 5.15**: Command already completed during cancellation attempt
- **Given** command that completes just as cancellation timeout expires
- **When** cancellation signal is sent after command natural completion
- **Then** cancellation should be safely ignored
- **And** no error should be generated for attempting to cancel completed command
- **And** final response should reflect natural completion, not interruption
- **And** subsequent commands should execute normally

### Complex Cancellation Scenarios

**AC 5.16**: Nested command cancellation testing
- **Given** script execution with cancellation: `{initiator: 'browser', command: 'bash -c "sleep 30 && echo done"', cancel: true, waitToCancelMs: 5000}`
- **When** cancellation timeout expires during nested script execution
- **Then** entire command hierarchy should be interrupted
- **And** bash script and sleep command should both be terminated
- **And** no orphaned processes should remain after cancellation

**AC 5.17**: Interactive nano editor cancellation
- **Given** browser command with nano editor cancellation: `{initiator: 'browser', command: 'nano /tmp/test.txt', cancel: true, waitToCancelMs: 4000}`
- **When** nano editor is launched and timeout expires
- **Then** nano editor should be forcefully cancelled via WebSocket SIGINT
- **And** terminal should show ^C interruption and exit nano cleanly
- **And** terminal should return to normal command prompt without hanging in editor mode
- **And** no orphaned nano processes should remain after cancellation

**AC 5.18**: Interactive command with user input cancellation
- **Given** interactive command with cancellation: `{initiator: 'browser', command: 'read -p "Enter input: " userInput', cancel: true, waitToCancelMs: 3000}`
- **When** command waits for user input and timeout expires
- **Then** interactive command should be cancelled via SIGINT
- **And** input prompt should be interrupted
- **And** terminal should return to normal command prompt
- **And** no hanging input state should remain

**AC 5.19**: Long sequence with multiple cancellations
- **Given** extended sequence with multiple cancellation points:
```typescript
postWebSocketCommands: [
  {initiator: 'browser', command: 'echo "start"'},
  {initiator: 'browser', command: 'sleep 20', cancel: true, waitToCancelMs: 2000},
  {initiator: 'browser', command: 'nano /tmp/test.txt', cancel: true, waitToCancelMs: 1500},
  {initiator: 'mcp-client', command: 'sleep 15', cancel: true, waitToCancelMs: 3000},
  {initiator: 'mcp-client', command: 'echo "end"'}
]
```
- **When** Villenele executes the complete sequence with multiple cancellations
- **Then** all cancellation timeouts should be respected independently
- **And** sequence should continue after each cancellation
- **And** final command should execute normally after all interruptions
- **And** session integrity should be maintained throughout

## Definition of Done

- [x] ✅ Timeout-based cancellation working for both browser and MCP command types
- [x] ✅ Protocol-specific cancellation mechanisms implemented (WebSocket SIGINT, MCP ssh_cancel_command)
- [x] ✅ Cancellation timing accuracy within acceptable tolerance ranges
- [x] ✅ Response capture working correctly for cancelled commands
- [x] ✅ Session state maintained properly after command interruptions
- [x] ✅ Error handling covers cancellation failure scenarios gracefully  
- [x] ✅ Complex cancellation scenarios (nested, interactive, sequential) working correctly
- [x] ✅ Post-cancellation session validation confirms continued functionality

## Technical Implementation Notes

### Cancellation Architecture
- **Timer Management**: Use setTimeout/clearTimeout for precise cancellation timing
- **Protocol Routing**: Different cancellation mechanisms based on initiator type
- **Signal Coordination**: Coordinate WebSocket signals and MCP tool calls appropriately
- **State Tracking**: Track cancellation state to prevent multiple attempts

### WebSocket Cancellation Implementation
```typescript
// WebSocket SIGINT signal format
{
  type: 'terminal_signal',
  sessionName: string,
  signal: 'SIGINT'
}
```

### MCP Cancellation Implementation
- **Tool Usage**: Utilize `ssh_cancel_command` tool for MCP command cancellation
- **Session Management**: Ensure session remains active after cancellation
- **Response Handling**: Capture and integrate cancellation responses appropriately

### Timing Precision Strategy
- **High-Resolution Timing**: Use performance.now() for accurate timing measurements
- **Cancellation Tolerance**: Allow reasonable tolerance (±500ms) for timing precision
- **Race Condition Prevention**: Handle cases where commands complete just as cancellation triggers

This story provides comprehensive command interruption capabilities that enable testing of real-world terminal scenarios where users need to cancel long-running or interactive commands.