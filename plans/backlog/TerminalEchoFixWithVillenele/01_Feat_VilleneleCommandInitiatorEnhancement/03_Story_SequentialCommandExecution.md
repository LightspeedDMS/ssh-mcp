# Story 03: Sequential Command Execution

## User Story

**As a** Villenele test developer  
**I want** sequential command execution with proper response waiting across dual channels (browser WebSocket and MCP JSON-RPC)  
**So that** I can ensure command ordering, response synchronization, and protocol-specific completion detection work correctly

## Acceptance Criteria

### Basic Sequential Execution Validation

**AC 3.1**: Browser-MCP command sequence execution
- **Given** command sequence `[{initiator: 'browser', command: 'pwd'}, {initiator: 'mcp-client', command: 'whoami'}]`
- **When** Villenele executes the sequence
- **Then** the browser command should complete via WebSocket terminal_input message
- **And** the MCP command should execute via JSON-RPC after browser command completion
- **And** concatenatedResponses should contain both command outputs in execution order

**AC 3.2**: MCP-Browser command sequence execution
- **Given** command sequence `[{initiator: 'mcp-client', command: 'date'}, {initiator: 'browser', command: 'ls'}]`
- **When** Villenele executes the sequence
- **Then** the MCP command should complete via JSON-RPC first
- **And** the browser command should execute via WebSocket after MCP command completion
- **And** execution order should be preserved in response capture

**AC 3.3**: Same-initiator command sequence execution
- **Given** command sequence `[{initiator: 'browser', command: 'pwd'}, {initiator: 'browser', command: 'whoami'}]`
- **When** Villenele executes the sequence
- **Then** both commands should execute via WebSocket terminal_input messages
- **And** second command should wait for first command completion
- **And** responses should maintain chronological order

### Protocol-Specific Response Waiting

**AC 3.4**: WebSocket command completion detection
- **Given** browser command execution via WebSocket terminal_input message
- **When** waiting for command completion
- **Then** Villenele should monitor WebSocket responses for command completion indicators
- **And** detect command prompt return: `[${process.env.USER}@localhost ${process.env.PWD}]$`
- **And** proceed to next command only after completion confirmation

**AC 3.5**: JSON-RPC command completion detection
- **Given** MCP command execution via stdin JSON-RPC
- **When** waiting for command completion
- **Then** Villenele should wait for JSON-RPC response message
- **And** parse response for command output and completion status
- **And** proceed to next command only after JSON-RPC response received

**AC 3.6**: Mixed protocol completion coordination
- **Given** alternating browser and MCP commands in sequence
- **When** executing across different protocols
- **Then** each command should use appropriate completion detection mechanism
- **And** sequence should not proceed until current command completes via its protocol
- **And** no protocol interference should occur between command types

### Response Synchronization and Ordering

**AC 3.7**: Chronological response preservation
- **Given** command sequence: `[{initiator: 'mcp-client', command: 'echo "first"'}, {initiator: 'browser', command: 'echo "second"'}, {initiator: 'mcp-client', command: 'echo "third"'}]`
- **When** Villenele executes the complete sequence
- **Then** concatenatedResponses should contain outputs in exact execution order
- **And** first command output should appear before second command output
- **And** third command output should appear after second command output

**AC 3.8**: Protocol response format preservation
- **Given** mixed browser and MCP commands execution
- **When** responses are captured from different protocols
- **Then** WebSocket responses should preserve CRLF line endings from browser perspective
- **And** JSON-RPC responses should maintain MCP server output format
- **And** protocol-specific formatting should be preserved in concatenatedResponses

**AC 3.9**: Command echo and result separation
- **Given** browser command `{initiator: 'browser', command: 'pwd'}`
- **When** executed via WebSocket terminal_input message
- **Then** concatenatedResponses should contain command echo: `pwd`
- **And** contain command result: `${process.env.PWD}`
- **And** command echo should appear before command result
- **And** proper separation should exist between echo and result

### Error Handling During Sequential Execution

**AC 3.10**: Command failure sequence continuation
- **Given** command sequence with failing middle command: `[{initiator: 'browser', command: 'pwd'}, {initiator: 'mcp-client', command: 'invalidcommand'}, {initiator: 'browser', command: 'whoami'}]`
- **When** the middle command fails
- **Then** Villenele should capture the error output from failing command
- **And** continue execution of remaining commands in sequence
- **And** all command outputs (successful and failed) should be included in concatenatedResponses

**AC 3.11**: Protocol communication failure handling
- **Given** WebSocket connection failure during browser command execution
- **When** browser command cannot be sent or response cannot be received
- **Then** Villenele should fail gracefully with error: "WebSocket communication failed during command execution"
- **And** provide diagnostic information about the connection failure
- **And** not proceed to subsequent commands until connection is restored

**AC 3.12**: Command timeout during sequence execution
- **Given** command sequence with long-running command: `[{initiator: 'browser', command: 'pwd'}, {initiator: 'mcp-client', command: 'sleep 60'}, {initiator: 'browser', command: 'whoami'}]`
- **When** middle command exceeds default timeout
- **Then** Villenele should timeout the long-running command appropriately
- **And** capture timeout error information
- **And** proceed to next command after timeout handling

### Complex Sequence Validation

**AC 3.13**: Extended mixed command sequence
- **Given** complex sequence:
```typescript
postWebSocketCommands: [
  {initiator: 'browser', command: 'pwd'},
  {initiator: 'mcp-client', command: 'date'},
  {initiator: 'browser', command: 'whoami'},
  {initiator: 'mcp-client', command: 'echo "mcp-test"'},
  {initiator: 'browser', command: 'echo "browser-test"'}
]
```
- **When** Villenele executes the complete sequence
- **Then** all 5 commands should execute in specified order
- **And** concatenatedResponses should contain all outputs chronologically
- **And** proper protocol routing should occur for each command type

**AC 3.14**: Sequence execution state maintenance
- **Given** long command sequence with mixed initiators
- **When** executing commands sequentially
- **Then** SSH session state should be maintained throughout entire sequence
- **And** working directory changes should persist across commands within sequence
- **And** environment variables should remain consistent across command types
- **And** session context should be preserved regardless of initiator protocol

**AC 3.15**: Response correlation and validation
- **Given** command sequence with expected outputs:
```typescript
[
  {initiator: 'browser', command: 'pwd'},     // Expected: ${process.env.PWD}
  {initiator: 'mcp-client', command: 'whoami'}, // Expected: ${process.env.USER}
  {initiator: 'browser', command: 'echo "test"'} // Expected: "test"
]
```
- **When** Villenele executes and captures responses
- **Then** each command's output should be identifiable in concatenatedResponses
- **And** response correlation should work correctly for both protocol types
- **And** output validation should confirm expected results for each command

## Definition of Done

- [x] ✅ Sequential execution works correctly for all initiator combinations
- [x] ✅ Protocol-specific response waiting implemented for WebSocket and JSON-RPC
- [x] ✅ Chronological response ordering preserved across mixed command sequences
- [x] ✅ Command completion detection working reliably for both protocol types
- [x] ✅ Error handling maintains sequence integrity with graceful failure modes
- [x] ✅ Complex mixed sequences execute completely with proper state maintenance
- [x] ✅ Response correlation and validation working correctly for dual-channel execution
- [x] ✅ WebSocket and JSON-RPC protocol isolation maintained without interference

## Technical Implementation Notes

### Sequential Execution Strategy
- **Promise Chain Coordination**: Use sequential Promise execution to ensure command ordering
- **Protocol-Specific Waiting**: Implement different completion detection for WebSocket vs JSON-RPC
- **State Management**: Maintain execution state across different protocol channels
- **Response Collection**: Unified response collection despite different communication protocols

### Completion Detection Mechanisms
- **WebSocket Completion**: Monitor for command prompt return in WebSocket messages
- **JSON-RPC Completion**: Wait for complete JSON-RPC response message
- **Protocol Isolation**: Ensure completion detection doesn't interfere between channels
- **Timeout Integration**: Apply appropriate timeouts per protocol type

### Error Recovery Strategy
- **Graceful Degradation**: Continue sequence execution despite individual command failures
- **Diagnostic Information**: Provide specific error details for troubleshooting
- **State Preservation**: Maintain session state even when individual commands fail
- **Retry Capability**: Enable retry logic for transient communication failures

This story ensures reliable sequential command execution across the dual-channel architecture while maintaining proper response synchronization and error handling.