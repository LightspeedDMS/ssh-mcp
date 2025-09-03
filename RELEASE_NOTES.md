# Release Notes

## v2.0.0 - Interactive Terminal Epic (September 2025)

### 🎉 Major New Features

**Interactive Browser Terminal**
- Full keyboard input and command execution directly in the web interface
- Local echo with immediate character display and cursor movement
- Command line editing with arrow keys, Home, End, and backspace support
- Terminal state management with smart locking/unlocking during command execution

**Concurrent Command Execution**
- User-typed commands and Claude Code commands execute seamlessly through shared SSH sessions
- FIFO command queuing prevents output interleaving between different command sources
- Source attribution tracks whether commands originated from "user" or "claude"
- Session state maintained consistently across all command sources

**Real-time WebSocket Communication**
- Bidirectional messaging between browser and server
- Live output streaming with no command echo duplication
- Multiple browser clients stay synchronized with terminal state
- Enhanced WebSocket message format with proper source attribution

### 🔧 Critical Fixes

**Double Echo Resolution**
- Fixed persistent issue where commands like `echo "hello"` appeared twice in terminal output
- Root cause: Missing `source` parameter in `broadcastToLiveListeners` call during SSH disconnection events
- Solution: Added proper source attribution to all broadcast calls

**Source Attribution Enhancement**
- Added `source: entry.source` field to all WebSocket messages (lines 382-394 in web-server-manager.ts)
- Enhanced command source type system with "user", "claude", and "system" types
- Proper source tracking through entire command execution pipeline

**Command Queue Management**
- Implemented FIFO queuing system in SSH connection manager
- Eliminated competing data handlers that caused duplicate broadcasts
- Commands from all sources execute in strict order without interference

### 🏗️ Architecture Improvements

**Unified Execution Path**
- Single command processing pipeline handles both MCP tools and browser input
- Shared SSH session manager enables seamless integration
- Consistent output formatting and error handling across command sources

**Enhanced WebSocket Handling**
- Improved message processing with better error handling
- Terminal input handler with complete keyboard interaction support
- Robust connection management with automatic reconnection

**Code Quality**
- Removed unused `streamTerminalOutput` method and helper functions
- Eliminated competing broadcast mechanisms
- Clean TypeScript compilation with no warnings

### 📚 Documentation Updates

**Complete Implementation Documentation**
- Detailed epic documentation in `plans/interactive-terminal-epic.md`
- All 5 user stories documented with acceptance criteria and validation status
- Architecture diagrams and component interaction flows

**Enhanced README**
- Updated feature list with interactive terminal capabilities
- Comprehensive architecture section with data flow diagrams
- Detailed usage examples for interactive terminal

**Test Coverage**
- Comprehensive test suite with user story validation
- Manual and automated test coverage for all features
- E2E tests with proper authentication setup

### ⚠️ Breaking Changes

**Web Interface Behavior**
- Web interface now supports interactive input (previously read-only monitoring)
- Users can type commands directly in the browser terminal
- Terminal locking behavior based on command execution status

**Command Execution Model**
- Unified command execution path for MCP tools and browser input
- Commands execute through shared SSH sessions with queuing
- Output streaming behavior standardized across command sources

**WebSocket Message Format**
- Enhanced message format includes source attribution
- Terminal state messages include command execution context
- Proper source-based terminal unlocking logic

### 🧪 Testing Status

**Manual Testing**: ✅ All interactive features validated
- Terminal input, output streaming, and state management working correctly
- Command execution from both Claude Code and browser verified
- No command echo duplication confirmed

**Automated Testing**: ⚠️ Core functionality verified, some test setup issues remain
- Unit tests passing for command queuing and source attribution
- E2E tests working with proper SSH authentication
- Some test expectations need updates for changed output formats

### 🚀 Upgrade Instructions

**For Existing Users**:
1. Pull latest changes and rebuild: `npm run build`
2. Restart Claude Code to pick up the updated server
3. Navigate to existing session monitoring URLs - they now support interactive input
4. Start typing commands directly in the browser terminal

**New Features Available**:
- Type commands directly in the browser terminal interface
- Commands execute in the same session as Claude Code tools
- Real-time output streaming with proper terminal state management

---

## v1.x.x - Foundation Release

### Core Features
- SSH session management via MCP protocol tools
- Read-only web monitoring interface with xterm.js
- Multiple SSH authentication methods (keys, passwords, direct content)
- Command history tracking with timestamps and exit codes
- Session persistence and isolation

### Architecture
- MCP server with stdio transport for Claude Code integration
- Web server with HTTP routes for session monitoring
- Basic SSH connection management with session state

### Authentication Support
- SSH key file authentication (RSA, ED25519, ECDSA)
- Username/password authentication
- Direct private key content support
- Encrypted key support with passphrase handling

---

*For detailed technical implementation information, see `plans/interactive-terminal-epic.md`*