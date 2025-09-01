# Epic: Live Session Terminal Viewer

## Epic Intent
Build a real-time terminal viewer that allows watching SSH session activity as it happens through MCP tool interactions. When MCP tools (ssh_connect, ssh_exec, etc.) are used, the corresponding session activity must be streamed live to a dedicated browser terminal interface.

## Overall Architecture

### Critical Architectural Constraint: Single Process Space
**MANDATORY**: The web server, WebSocket server, and MCP server MUST run in the same Node.js process to enable real-time terminal broadcasting. This is required because:
- SSH sessions and terminal buffers must be in shared memory with WebSocket connections
- MCP tool execution (ssh_exec) must directly broadcast to WebSocket clients with zero latency
- No IPC or separate processes can be used - everything must be direct memory access

### Single Process Architecture
```
┌─── UNIFIED SSH MCP SERVER PROCESS ────────────────────────┐
│                                                           │
│  MCP Server (stdio) ←→ SSH Manager ←→ WebSocket Server    │
│                           ↑    ↓            ↓            │
│                     Terminal Buffers    Express Web      │
│                           ↓                ↓             │
│                    Real-time Broadcast  Static Files     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### High-Level Components
1. **Unified SSH MCP Server**: Single Node.js process running MCP server, web server, and WebSocket server
2. **Session-Specific Terminal Streams**: Each SSH session maintains a real-time output buffer with direct WebSocket broadcasting
3. **WebSocket Session Streaming**: Dedicated WebSocket endpoint per session (`/ws/session/{session-name}`) with direct memory access to terminal buffers
4. **xterm.js Dark Terminal Interface**: Browser-based dark-mode terminal that displays live SSH session output
5. **Direct Memory Broadcasting**: SSH connection manager directly writes to WebSocket streams when commands execute

### Technology Stack
- **Backend**: Single Node.js process with Express, WebSocket (ws), and MCP SDK
- **Frontend**: xterm.js with dark terminal theme
- **Protocol**: WebSocket for zero-latency real-time communication
- **Integration**: Direct memory access between SSH manager and WebSocket streams

### Component Connections
```
MCP Tools (ssh_exec) → SSH Manager → Direct Memory Write → WebSocket Broadcast → xterm.js Dark Terminal
                        ↑ Same Process ↑
```

## Story 1: Session-Specific Terminal Output Streaming
As a user watching SSH activity, I want each SSH session to stream its terminal output in real-time so I can see exactly what happens when MCP tools execute commands.

### Acceptance Criteria
- **Given** an SSH session named "test-session" exists
- **When** commands are executed via ssh_exec MCP tool
- **Then** all terminal output (stdout/stderr) is captured and buffered in real-time
- **And** output includes command prompts, executed commands, and their complete output
- **And** output maintains proper terminal formatting and escape sequences
- **And** terminal buffer maintains scrollback history of last 1000 lines
- **And** buffer is session-specific and isolated from other sessions

**Performance Requirements:**
- Terminal output must stream with <100ms latency
- Buffer must handle high-frequency output without loss
- Memory usage per session must not exceed 10MB

## Story 2: Dedicated WebSocket Endpoints Per Session  
As a developer integrating with the terminal viewer, I want dedicated WebSocket endpoints for each session so I can subscribe to specific session activity.

### Acceptance Criteria
- **Given** a session named "demo-session" exists
- **When** I connect to WebSocket endpoint `/ws/session/demo-session`
- **Then** the connection is established successfully
- **And** I receive real-time terminal output for that specific session only
- **And** WebSocket sends terminal data as JSON messages with timestamps
- **And** WebSocket handles connection drops with automatic reconnection
- **And** multiple clients can connect to the same session WebSocket
- **And** invalid session names return proper WebSocket error codes

**Message Format:**
```json
{
  "type": "terminal_output",
  "sessionName": "demo-session", 
  "timestamp": "2025-08-31T10:30:45.123Z",
  "data": "$ whoami\ntest_user\n"
}
```

## Story 3: Session-Specific Terminal URLs
As a user monitoring SSH activity, I want dedicated URLs for each session so I can bookmark and directly access specific session terminals.

### Acceptance Criteria
- **Given** an SSH session named "production-server"
- **When** I navigate to `/session/production-server`
- **Then** a dedicated terminal interface loads for that session only
- **And** the page displays an xterm.js terminal connected to that session's WebSocket
- **And** the terminal shows historical output from session buffer
- **And** the terminal receives live updates as new commands execute
- **And** the URL is bookmarkable and shareable
- **And** accessing non-existent session URLs shows appropriate error message

**URL Structure:**
- `/session/{session-name}` - Live terminal view for specific session
- `/ws/session/{session-name}` - WebSocket endpoint for session

## Story 4: MCP Tool Integration with Terminal Streaming
As a developer using SSH MCP tools, I want all MCP tool activity to be automatically streamed to the terminal viewer so I can watch commands execute in real-time.

### Acceptance Criteria
- **Given** I use ssh_connect MCP tool to create "api-server" session
- **When** the connection is established
- **Then** connection activity appears in `/session/api-server` terminal
- **And** terminal shows connection establishment messages
- **Given** I use ssh_exec MCP tool to run "ls -la" on "api-server"
- **When** the command executes
- **Then** terminal displays the command prompt, executed command, and complete output
- **And** terminal shows command execution in real-time (not just final result)
- **And** stderr and stdout are both captured and displayed
- **And** command exit codes are visible in terminal

**Integration Requirements:**
- All ssh_exec commands must appear in terminal with prompt simulation
- Connection/disconnection events must be logged to terminal
- Terminal must maintain proper command history and prompts

## Story 5: xterm.js Dark Mode Terminal Interface Implementation  
As a user viewing SSH sessions, I want a dark mode terminal interface that looks and behaves like a real terminal so I can easily read and understand the session activity in a comfortable dark theme.

### Acceptance Criteria
- **Given** I access `/session/test-session` URL
- **When** the page loads
- **Then** an xterm.js terminal renders properly in the browser with dark mode theme
- **And** terminal uses dark background (#000000 or #1a1a1a) with light text (#ffffff or #f0f0f0)
- **And** terminal uses monospace font (Fira Code, Consolas, or Monaco)
- **And** terminal displays session name and connection status in dark-themed header
- **And** terminal automatically scrolls to show latest output
- **And** terminal allows manual scrolling through history
- **And** terminal properly renders ANSI colors optimized for dark background
- **And** terminal is responsive and works on different screen sizes
- **And** entire page uses dark theme (dark background, no bright elements)

**Dark Mode Theme Requirements:**
```json
{
  "background": "#1a1a1a",
  "foreground": "#f0f0f0", 
  "cursor": "#ffffff",
  "selection": "#333333",
  "black": "#000000",
  "red": "#ff6c6b",
  "green": "#98be65",
  "yellow": "#ecbe7b", 
  "blue": "#51afef",
  "magenta": "#c678dd",
  "cyan": "#46d9ff",
  "white": "#bbc2cf"
}
```

**Visual Requirements (Dark Mode - Clean Terminal, No Boxes):**
```
SSH Session: test-session
🟢 Connected | Host: localhost | User: test_user

$ ssh test_user@localhost
Last login: Sun Aug 31 10:30:45 2025 from localhost
$ whoami
test_user
$ pwd
/home/test_user
$ ls -la | head -3
total 540
drwxr-xr-x  22 test_user test_user  8192 Aug 31 17:32 .
drwxr-xr-x+  8 root      root        112 Aug 28 22:47 ..
$ 
```
*Note: Clean terminal appearance with dark background, light text, no borders or boxes*

**UI Requirements:**
- No borders, frames, or boxes around terminal
- No visual separators or dividers
- Clean, minimal header with session info
- Pure terminal output display
- Focus entirely on terminal content

## Story 6: Real-Time Command Execution Visualization
As a user monitoring SSH activity, I want to see commands execute in real-time with proper timing so I understand exactly what's happening and when.

### Acceptance Criteria
- **Given** I'm watching `/session/demo-session` in browser
- **When** ssh_exec MCP tool executes "ping -c 3 google.com"
- **Then** terminal shows command prompt appearing immediately
- **And** terminal shows "ping -c 3 google.com" being typed/executed
- **And** terminal shows ping responses appearing one by one in real-time
- **And** terminal shows command completion with exit code
- **And** terminal maintains proper timing between command start and completion
- **And** long-running commands show output as it streams (not batched)

**Timing Requirements:**
- Command prompts must appear within 50ms of MCP tool invocation
- Streaming output must have <100ms latency from actual command output
- Command completion must be immediately visible

**Command Visualization Format:**
```
$ ping -c 3 google.com
PING google.com (172.217.15.110) 56(84) bytes of data.
64 bytes from google.com (172.217.15.110): icmp_seq=1 ttl=119 time=12.3 ms
64 bytes from google.com (172.217.15.110): icmp_seq=2 ttl=119 time=11.8 ms  
64 bytes from google.com (172.217.15.110): icmp_seq=3 ttl=119 time=12.1 ms

--- google.com ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2003ms
rtt min/avg/max/mdev = 11.847/12.067/12.334/0.201 ms
$ [Exit Code: 0]
```