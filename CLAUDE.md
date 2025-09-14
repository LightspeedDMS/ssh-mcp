# LS-SSH-MCP Project Documentation

## Terminal Echo Duplication Fix (v2.0.1)

### Issue Resolution

**Problem**: Terminal commands showed duplicate output with different formatting - clean output followed by mangled output without ANSI colors.

**Root Cause**: Dual broadcast architecture in `ssh-connection-manager.ts` where SSH stream data was processed through two different paths:
1. Raw SSH stream (preserved ANSI colors and formatting) 
2. Processed stream through `prepareOutputForBrowser()` (stripped ANSI codes, mangled spacing)

**Solution**: Modified `broadcastToLiveListeners()` method to conditionally process data based on source type:
- SSH stream data (source === 'system') bypasses `prepareOutputForBrowser()` 
- Non-SSH data continues processing for necessary cleanup
- Implementation at `ssh-connection-manager.ts:205`

**Result**: Single clean terminal output with preserved ANSI colors and formatting. xterm.js handles ANSI codes natively, eliminating need for server-side processing of SSH streams.

**Validation**: All Villenele testing framework tests passing with exact assertions. Terminal behavior now matches standard SSH client experience.

---

## Villenele - Terminal History Testing Framework

**Framework Name**: **Villenele**

Villenele is the official name for our comprehensive Terminal History Testing Framework. When referenced by name, "Villenele" refers to the complete 9-story epic testing infrastructure designed specifically for SSH terminal emulation validation.

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

## MCP Server URL Management - CRITICAL WORKFLOW

### Dynamic Port Discovery
**GOLDEN RULE**: NEVER hardcode port numbers when testing terminal URLs. The MCP server uses dynamic ports that change between sessions.

### Proper Workflow for Terminal URL Testing
1. **Connect via MCP**: Always use `mcp__ssh__ssh_connect` to establish sessions
2. **Get Dynamic URL**: Use `mcp__ssh__ssh_get_monitoring_url` to retrieve the actual URL
3. **Test with Real URL**: Use the MCP-provided URL for all testing and validation

### Example Workflow
```typescript
// ✅ CORRECT: Use MCP server for dynamic URL
const connection = await mcp__ssh__ssh_connect({
  name: "test-session",
  host: "localhost", 
  username: "jsbattig",
  keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
});

const urlResponse = await mcp__ssh__ssh_get_monitoring_url({
  sessionName: "test-session"
});

// Use urlResponse.monitoringUrl for testing
console.log(`Terminal URL: ${urlResponse.monitoringUrl}`);
```

### Common Mistakes to Avoid
- ❌ **WRONG**: `http://localhost:8085/session/my-session` (hardcoded port)  
- ✅ **CORRECT**: Use MCP server's `monitoringUrl` response

### WebSocket Connection Debugging
When encountering "⚠️ Message Error" in browser terminals:

1. **Verify HTML loads**: `curl -s [MCP_URL] | head -20`
2. **Verify JavaScript loads**: `curl -s [MCP_URL_BASE]/terminal-input-handler.js | head -10`
3. **Test WebSocket endpoint**: `curl -v -H "Connection: Upgrade" -H "Upgrade: websocket" [MCP_URL_BASE]/ws/session/[SESSION_NAME]`
4. **Check browser console** for specific WebSocket connection errors

### URL Structure Understanding
- **HTML Endpoint**: `http://localhost:[DYNAMIC_PORT]/session/[SESSION_NAME]`
- **WebSocket Endpoint**: `ws://localhost:[DYNAMIC_PORT]/ws/session/[SESSION_NAME]`
- **Static Assets**: `http://localhost:[DYNAMIC_PORT]/terminal-input-handler.js`

**Port Discovery**: Only the MCP server knows the current port. Always query it first.

**CRITICAL**: The `mcp__ssh__ssh_get_monitoring_url` function returns the CORRECT port. Server logs may show a different port than what actually serves HTTP requests. Always trust the MCP client URL response over server logs or netstat output.

## Pre-Commit Validation Workflow - CRITICAL REQUIREMENT

### CI Validation Script - MANDATORY BEFORE COMMITS
**GOLDEN RULE**: Before any commit, MUST run CI validation to ensure GitHub Actions will pass.

### Available Validation Commands
- `npm run ci-validate` - Full GitHub Actions mirror validation
- `npm run precommit` - Alias for ci-validate (runs automatically on commit)
- `./scripts/ci-validation.sh` - Direct script execution

### CI Validation Script Components
The `scripts/ci-validation.sh` script mirrors GitHub Actions exactly:

1. **Dependency Installation**: `npm ci` (clean install)
2. **Build Verification**: `npm run build` 
3. **SSH Localhost Setup**: Generate keys, setup authorized_keys, verify connectivity
4. **Linting**: Run ESLint if configured
5. **TypeScript Check**: `tsc --noEmit` compilation verification
6. **Quick Regression Tests**: `--testPathPattern="regression-prevention" --testNamePattern="Echo Regression Detection"`
7. **Comprehensive Regression**: `--testPathPattern="regression-prevention" --maxWorkers=4`
8. **Performance Regression**: `--testNamePattern="Performance" --testPathPattern="regression-prevention"`
9. **Villenele Framework**: `--testPathPattern="terminal-history-framework" --bail`
10. **Coverage Report**: `--coverage --testPathPattern="regression-prevention"`

### Commit Workflow Integration - MANDATORY
**ABSOLUTE REQUIREMENT**: When using `/commit-all` or any commit operation:

1. **FIRST**: Run `npm run ci-validate` 
2. **SECOND**: Only commit if validation passes 100%
3. **THIRD**: Fix any failing validations before committing

### CI Validation Failure Handling
- **Build Failures**: Fix TypeScript/compilation errors
- **Lint Failures**: Run `npm run lint:fix` or fix manually  
- **Test Failures**: Debug and fix failing tests
- **SSH Setup Issues**: Ensure SSH service running and keys configured

### Integration with /commit-all Command
The `/commit-all` command MUST:
1. Execute `npm run ci-validate` first
2. Only proceed with commit if all validations pass
3. Report validation failures and stop commit process
4. Never commit with failing CI validations

### Validation Script Benefits
- **GitHub Actions Mirror**: Identical to CI environment
- **Early Problem Detection**: Catch issues before push
- **SSH Environment Setup**: Automatic localhost testing setup  
- **Comprehensive Coverage**: All regression prevention tests
- **Performance Monitoring**: Detect performance regressions

**VIOLATION CONSEQUENCES**: Committing without CI validation leads to GitHub Actions failures and broken CI pipeline.

- every time you change anything related to conversation display, when you are done doing changes, you must run all Villenele tests, always, no exceptions.

## Manual Browser Testing - Headless Terminal Test Script

### Location and Usage
**Script**: `scripts/headless-terminal-test.cjs` (executable)

### Purpose
Provides manual end-to-end testing of SSH terminal functionality using headless Puppeteer browser automation. Validates:
- Terminal page loading and initialization
- JavaScript error detection
- Terminal content display (vs CSS-only issues)
- User typing and interaction functionality
- Echo suppression fix validation

### Usage Examples
```bash
# Basic usage with any terminal session URL
node scripts/headless-terminal-test.cjs http://localhost:8081/session/my-session

# Quick manual test workflow:
# 1. Connect via MCP: mcp__ssh__ssh_connect
# 2. Execute command: mcp__ssh__ssh_exec  
# 3. Get URL: mcp__ssh__ssh_get_monitoring_url
# 4. Run test: node scripts/headless-terminal-test.cjs [URL]
```

### Key Features
- **Parameterized URL**: Takes terminal URL as command line argument
- **Content Validation**: Distinguishes between actual terminal content and CSS artifacts
- **JavaScript Error Detection**: Reports browser console errors and page errors
- **Interaction Testing**: Validates typing functionality and terminal responsiveness
- **Exit Codes**: Returns proper exit codes for CI/automation integration
- **Auto-installation**: Automatically installs Puppeteer if not available

### Expected Output
- ✅ **PASSED**: Terminal loads correctly, shows content, typing works
- ❌ **FAILED**: Display issues, CSS-only content, or interaction failures

### Integration with MCP Workflow
Perfect for validating echo suppression fixes and browser terminal functionality after making changes to WebSocket message processing or terminal display logic.
- Any time I ask you to commit and push, either by telling you, or by using the /commit-all command and then I ask  you to push, you will watch for the regression testing job in github using the gh command. If there's any regression you will fetch the failure information, you will immediately troubleshoot the problem, fix it with the tdd-engineer and the code-reviewer and proceed to commit (github and gitlab) and monitor again. You will execute this loop until we have a clean run.