# Epic: Terminal History Testing Framework

## Overview

Build a comprehensive testing framework to validate terminal history formatting and WebSocket behavior without manual browser testing. The framework simulates real browser-MCP server interactions with pre/post WebSocket command phases.

## Overall Architecture

```
┌─────────────────┐    stdin/stdout    ┌─────────────────┐
│  Testing Tool   │◄──────────────────►│   MCP Server    │
│                 │                    │                 │
│ ┌─────────────┐ │                    │ ┌─────────────┐ │
│ │ MCP Client  │ │                    │ │ SSH Manager │ │
│ └─────────────┘ │                    │ └─────────────┘ │
│                 │                    │                 │
│ ┌─────────────┐ │    WebSocket       │ ┌─────────────┐ │
│ │ WS Client   │ │◄──────────────────►│ │ Web Server  │ │
│ └─────────────┘ │                    │ └─────────────┘ │
└─────────────────┘                    └─────────────────┘
```

**Core Components:**
- **MCP Client**: Communicates via stdin/stdout (simulates Claude Code)
- **WebSocket Client**: Connects to web server (simulates browser)  
- **Command Executor**: Orchestrates pre/post WebSocket command phases
- **Response Collector**: Captures and concatenates all WebSocket messages

**Technology Stack:**
- TypeScript for type safety
- Node.js child_process for MCP server launching
- WebSocket client library for browser simulation
- Jest for test framework integration

## User Stories

### Story 1: MCP Server Lifecycle Management
As a developer testing terminal history formatting  
I want the framework to automatically launch and manage MCP server instances  
So that I can run isolated tests without manual server management

**Acceptance Criteria:**
```gherkin
Given I want to test terminal history formatting
When I invoke the testing framework
Then it should launch a fresh MCP server instance
And establish stdin/stdout communication
And clean up the server process when testing completes
And handle server startup failures gracefully
And ensure no port conflicts with other test runs
```

### Story 2: Pre-WebSocket Command Execution  
As a developer testing initial browser load behavior  
I want to execute commands before WebSocket connection  
So that I can build up terminal history that browsers see on first load

**Acceptance Criteria:**
```gherkin
Given I have specified pre-WebSocket commands ["ssh_connect", "ssh_exec ls"]
When the testing framework executes the pre-phase
Then it should send each command via MCP stdin/stdout
And wait for MCP responses before proceeding to next command
And not capture any WebSocket data during this phase
And build up terminal history in the MCP server
And complete all pre-commands before WebSocket connection
```

### Story 3: Dynamic WebSocket Connection Discovery
As a developer testing WebSocket behavior  
I want the framework to discover the monitoring URL dynamically  
So that tests work regardless of which port the MCP server selects

**Acceptance Criteria:**
```gherkin
Given the MCP server is running on an unknown port
When I need to establish WebSocket connection
Then it should send get_monitoring_url command via MCP
And parse the returned URL to extract WebSocket endpoint
And establish WebSocket connection to the discovered endpoint
And handle connection failures with clear error messages
And validate the WebSocket connection is ready before proceeding
```

### Story 4: Initial History Replay Capture
As a developer validating terminal history formatting  
I want to capture the initial WebSocket messages on connection  
So that I can verify what browsers see when they first load the terminal

**Acceptance Criteria:**
```gherkin
Given I have executed pre-WebSocket commands
When I establish WebSocket connection
Then it should capture all initial history replay messages
And wait for history replay to complete before proceeding
And distinguish between history replay and real-time messages
And preserve exact message order and formatting
And handle empty history gracefully
```

### Story 5: Post-WebSocket Real-time Command Execution
As a developer testing real-time terminal updates  
I want to execute commands after WebSocket connection  
So that I can verify how browsers see live command execution

**Acceptance Criteria:**
```gherkin
Given I have established WebSocket connection
And I have specified post-WebSocket commands ["ssh_exec whoami"]
When the testing framework executes the post-phase
Then it should send each command via MCP stdin/stdout
And capture corresponding WebSocket messages for each command
And wait for WebSocket responses before sending next command
And preserve message ordering between commands
And handle command execution failures appropriately
```

### Story 6: Comprehensive Response Collection and Output
As a developer analyzing terminal behavior  
I want all WebSocket responses concatenated verbatim  
So that I can evaluate the exact browser experience programmatically

**Acceptance Criteria:**
```gherkin
Given I have executed both pre and post WebSocket phases
When all commands complete or timeout occurs
Then it should return concatenated WebSocket responses verbatim
And preserve exact formatting including CRLF line endings
And include both history replay and real-time messages
And provide clear separation between message phases
And handle timeout scenarios gracefully (10-second limit)
And clean up all resources (server, WebSocket, etc.)
```

### Story 7: Flexible Command Configuration
As a developer testing various terminal scenarios  
I want to configure different command combinations easily  
So that I can test edge cases and different usage patterns

**Acceptance Criteria:**
```gherkin
Given I want to test different terminal scenarios
When I configure the testing framework
Then it should accept JSON configuration with preWebSocketCommands and postWebSocketCommands arrays
And support empty arrays for either phase
And validate command syntax before execution
And provide clear error messages for invalid configurations
And support complex command scenarios like multiple SSH sessions
```

### Story 8: Robust Error Handling and Diagnostics
As a developer debugging terminal issues  
I want comprehensive error reporting and diagnostics  
So that I can quickly identify and fix problems

**Acceptance Criteria:**
```gherkin
Given something goes wrong during testing
When an error occurs in any phase
Then it should provide detailed error messages with context
And include relevant timestamps and command sequences
And capture server logs and WebSocket connection states
And clean up resources even when errors occur
And provide actionable debugging information
And distinguish between framework errors and application errors
```

## Testing Infrastructure Requirements

### Story 9: Jest Integration and Test Utilities
As a developer writing terminal history tests  
I want the framework integrated with our existing test infrastructure  
So that I can write comprehensive test cases easily

**Acceptance Criteria:**
```gherkin
Given I want to write tests using the framework
When I create test files
Then the framework should integrate with Jest test runner
And provide helper utilities for common test patterns  
And support async/await patterns for test execution
And provide assertion helpers for WebSocket message validation
And enable parameterized tests for multiple scenarios
```

## Implementation Notes

- Place framework in `tests/integration/terminal-history-framework/`
- Use TypeScript for type safety and better developer experience
- Implement graceful cleanup in all error scenarios
- Provide comprehensive logging for debugging
- Support concurrent test execution with proper isolation
- Follow existing project conventions and code style