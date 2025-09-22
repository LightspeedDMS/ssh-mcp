# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-09-22

### Added
- **ssh_version tool**: New MCP endpoint for version introspection and build information
- **Complete browser terminal editing support**: Mid-line character insertion and deletion
- **Delete key functionality**: Standard terminal delete key behavior with proper text handling
- **Unicode character support**: Expanded character input range including accented characters and tab
- **Enhanced navigation**: Improved Home/End key behavior for line-based navigation

### Fixed
- **Echo suppression abomination removal**: Eliminated client-side output filtering for server-controlled display
- **Multi-character input vulnerability**: Fixed cursor positioning for paste operations and multi-byte characters
- **XSS security vulnerability**: Secured error message display against script injection
- **Mid-line backspace artifacts**: Resolved visual spacing issues during character deletion
- **Browser editing synchronization**: Perfect alignment between visual display and internal command state

### Security
- **Axios CVE-2025-58754**: Upgraded to axios@1.12.2 to fix DoS vulnerability via data: URIs
- **XSS prevention**: Replaced innerHTML with textContent for user-provided error messages
- **Input validation**: Enhanced character validation and boundary checking

### Technical
- **Surgical implementation**: Precise line-level fixes maintaining zero regression risk
- **ES module compatibility**: Fixed __dirname issues for proper module resolution
- **Version synchronization**: Aligned package.json and server versions for consistency
- **Code quality improvements**: Eliminated complexity and improved maintainability

## [2.0.1] - 2025-09-12

### Fixed
- Terminal echo duplication where commands showed duplicate output with different formatting
- Dual broadcast architecture causing SSH stream data to be processed twice
- ANSI color codes being stripped from terminal output
- Mangled formatting in duplicate terminal output
- Modified `broadcastToLiveListeners` to bypass `prepareOutputForBrowser` processing for SSH stream data
- Preserved native xterm.js ANSI code handling for proper terminal display

### Technical
- SSH stream output (source === 'system') now bypasses ANSI stripping
- Non-SSH data continues to process through `prepareOutputForBrowser` for cleanup
- All Villenele testing framework tests passing with exact assertions
- CRLF line endings maintained for xterm.js compatibility

## [2.0.0] - 2025-09-XX

### Added
- Interactive browser terminal with full keyboard input support
- Local echo with immediate character display and cursor movement
- Command line editing with arrow keys, Home, End, and backspace
- Terminal state management with locking during command execution
- Concurrent command execution between user input and Claude Code
- FIFO command queuing to prevent output interleaving
- Source attribution tracking for commands from different sources
- Real-time WebSocket communication for bidirectional messaging
- Session state synchronization across multiple browser clients

### Changed
- Web interface now supports interactive input (previously read-only)
- Unified command execution path for MCP tools and browser input
- Enhanced WebSocket message format with source attribution
- Terminal unlocking logic based on command source and execution status

### Fixed
- Command echo duplication issues in terminal output
- Missing source parameter in WebSocket broadcast calls
- Competing data handlers causing duplicate broadcasts
- Output interleaving between different command sources

### Technical
- Complete rewrite of terminal input handling system
- Enhanced SSH connection manager with command queuing
- Improved WebSocket message processing with error handling
- Comprehensive test suite with user story validation

## [1.0.0] - 2025-08-XX

### Added
- SSH session management via MCP protocol tools
- Read-only web monitoring interface with xterm.js
- Multiple SSH authentication methods (keys, passwords, direct content)
- Command history tracking with timestamps and exit codes
- Session persistence and isolation
- SSH key file authentication (RSA, ED25519, ECDSA)
- Username/password authentication
- Encrypted key support with passphrase handling
- Basic SSH connection management with session state
- MCP server with stdio transport for Claude Code integration
- Web server with HTTP routes for session monitoring

### Technical
- TypeScript implementation with ES modules
- Jest testing framework with comprehensive test coverage
- Express web server with WebSocket support
- SSH2 library for SSH connection management
- xterm.js for browser terminal emulation