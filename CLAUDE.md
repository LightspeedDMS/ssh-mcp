# LS-SSH-MCP Project Documentation

## Terminal History Testing Framework

### Purpose and Overview

The Terminal History Testing Framework is a comprehensive testing infrastructure designed to validate SSH terminal emulation and WebSocket-based browser terminal display. It addresses the critical challenge of testing terminal history formatting, command echo behavior, and real-time terminal interactions in a browser environment.

### Core Problem Solved

The framework specifically solves issues with terminal prompt concatenation and display formatting that occurred when browsers connected to SSH sessions. Original problems included:

- Concatenated prompts like `lstest_user@localhost:~$` instead of proper separation
- Missing command results in terminal history replay
- Improper CRLF line ending handling for xterm.js compatibility
- Command echo and result separation issues

### Architecture - 9-Story Epic Implementation

The framework is built using a modular, story-based architecture with comprehensive integration:

#### **Story 1: MCP Server Manager**
- **Purpose**: Server lifecycle management
- **Component**: `MCPServerManager`
- **Capabilities**: Start/stop MCP server, process management, health monitoring

#### **Story 2: Pre-WebSocket Command Executor**
- **Purpose**: Execute SSH commands before WebSocket connection
- **Component**: `PreWebSocketCommandExecutor` 
- **Capabilities**: SSH authentication, command execution, session establishment

#### **Story 3: WebSocket Connection Discovery**
- **Purpose**: Discover and establish WebSocket connections
- **Component**: `WebSocketConnectionDiscovery`
- **Capabilities**: URL discovery, connection establishment, handshake validation

#### **Story 4: Initial History Replay Capture**
- **Purpose**: Capture initial terminal history when browsers connect
- **Component**: `InitialHistoryReplayCapture`
- **Capabilities**: Message distinction (history vs real-time), CRLF preservation, chronological ordering

#### **Story 5: Post-WebSocket Command Executor**
- **Purpose**: Execute real-time commands after WebSocket connection
- **Component**: `PostWebSocketCommandExecutor`
- **Capabilities**: Real-time command execution, live response capture

#### **Story 6: Comprehensive Response Collector** 
- **Purpose**: Orchestrate complete testing workflow
- **Component**: `ComprehensiveResponseCollector`
- **Capabilities**: Stories 1-5 integration, timeout handling, verbatim response concatenation

#### **Story 7: Flexible Command Configuration**
- **Purpose**: JSON-based configuration management
- **Component**: `FlexibleCommandConfiguration`
- **Capabilities**: Command permutation management, timeout configuration, session naming

#### **Story 8: Robust Error Diagnostics**
- **Purpose**: Enhanced debugging and error analysis
- **Component**: `RobustErrorDiagnostics`
- **Capabilities**: Detailed error reporting, component state analysis, troubleshooting guidance

#### **Story 9: Jest Integration Utilities**
- **Purpose**: Jest test runner integration with custom matchers
- **Component**: `JestTestUtilities`
- **Capabilities**: Test orchestration, assertion helpers, parameterized testing, custom matchers

### Key Technical Capabilities

#### **Real MCP Integration (No Mocks)**
- Uses actual MCP (Model Context Protocol) server via stdin/stdout JSON-RPC 2.0
- Real SSH connections with SSH key authentication
- Genuine WebSocket connections to capture browser perspective
- Zero mocking in production code - all functionality is working code

#### **CRLF Line Ending Preservation**
- Critical for xterm.js browser terminal compatibility
- Maintains `\r\n` line endings from SSH connection manager
- Prevents terminal display issues and broken formatting

#### **Command Permutation Testing**
- Pre-WebSocket command execution testing
- Post-WebSocket real-time command testing
- Mixed command scenario validation
- Exact assertion capabilities for command counting and sequencing

#### **Bracket Prompt Format Support**
- Updated to support modern bracket prompt format: `[username@hostname directory]$`
- Migrated from traditional `username@hostname:directory$` format
- Comprehensive regex pattern updates for prompt detection
- Backward compatibility during transition

#### **WebSocket Message Validation**
- Verbatim WebSocket response concatenation
- Command echo verification
- Result presence validation
- No concatenation detection (negative assertions)
- Chronological message ordering

### Framework Usage

#### **Basic Test Setup**
```typescript
const testUtils = JestTestUtilities.setupJestEnvironment('test-suite-name');

const config = {
  preWebSocketCommands: [
    'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
    'ssh_exec {"sessionName": "test-session", "command": "pwd"}'
  ],
  postWebSocketCommands: [
    'ssh_exec {"sessionName": "test-session", "command": "whoami"}'
  ],
  workflowTimeout: 30000,
  sessionName: 'test-session'
};

const result = await testUtils.runTerminalHistoryTest(config);
```

#### **WebSocket Message Assertions**
```typescript
testUtils.expectWebSocketMessages(result.concatenatedResponses)
  .toContainCRLF()
  .toHavePrompts()
  .toMatchCommandSequence(['pwd', 'whoami'])
  .toHaveMinimumLength(10)
  .validate();
```

#### **Custom Jest Matchers**
```typescript
expect(terminalOutput).toHaveValidTerminalHistory();
expect(terminalOutput).toContainCRLFLineEndings();
```

### File Structure

```
tests/integration/terminal-history-framework/
├── mcp-server-manager.ts                    # Story 1: Server lifecycle
├── mcp-client.ts                           # MCP protocol client
├── pre-websocket-command-executor.ts       # Story 2: Pre-WebSocket commands
├── websocket-connection-discovery.ts       # Story 3: WebSocket discovery
├── initial-history-replay-capture.ts       # Story 4: History capture
├── post-websocket-command-executor.ts      # Story 5: Post-WebSocket commands
├── comprehensive-response-collector.ts     # Story 6: Workflow orchestration
├── flexible-command-configuration.ts       # Story 7: Configuration management
├── robust-error-diagnostics.ts            # Story 8: Error diagnostics
└── jest-test-utilities.ts                 # Story 9: Jest integration
```

### Test Files

```
tests/
├── terminal-history-validation.test.ts              # Core validation tests
├── terminal-history-command-permutations-e2e.test.ts # E2E command permutation tests
└── bracket-prompt-format.test.ts                    # Bracket format validation tests
```

### Dependencies and Integration

#### **External Dependencies**
- `ssh2`: SSH client functionality
- `ws`: WebSocket implementation
- `xterm.js`: Browser terminal emulation (via CRLF requirements)
- `jest`: Test runner integration

#### **Internal Integration Points**
- `src/ssh-connection-manager.ts`: SSH session management and prompt formatting
- `src/web-server-manager.ts`: WebSocket server and history replay
- `src/types.ts`: Type definitions for SSH operations

### Validation Evidence

#### **Framework Effectiveness**
- ✅ Captures exact bracket prompt format: `[jsbattig@localhost ls-ssh-mcp]$ command`
- ✅ Preserves CRLF line endings for xterm.js compatibility
- ✅ Validates command echo and result separation
- ✅ Detects and prevents prompt concatenation issues
- ✅ Comprehensive E2E test coverage with 5+ test scenarios
- ✅ Zero-mock production code architecture

#### **Test Results**
- Bracket format validation: ✅ Working
- CRLF preservation: ✅ Verified
- Command permutation testing: ✅ 5 scenarios covered
- WebSocket message validation: ✅ Comprehensive assertions
- Real MCP integration: ✅ No mocks, real functionality

### Framework Benefits

1. **Real-world Validation**: Tests actual browser perspective via WebSocket capture
2. **Comprehensive Coverage**: Pre/post WebSocket command scenarios with exact assertions
3. **CRLF Compliance**: Ensures xterm.js terminal compatibility
4. **TDD Integration**: Built with Test-Driven Development methodology
5. **Zero-Mock Architecture**: Uses real MCP server, SSH connections, WebSocket communications
6. **Maintainability**: Modular design with clear component separation
7. **Debugging Support**: Enhanced error diagnostics and troubleshooting capabilities

This framework provides the definitive solution for validating SSH terminal emulation and browser terminal display formatting, ensuring proper prompt handling, command separation, and xterm.js compatibility.