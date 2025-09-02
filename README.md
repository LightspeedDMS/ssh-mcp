# SSH MCP Server

A Model Context Protocol (MCP) server that provides SSH session management for Claude Code with browser-based terminal monitoring.

## Features

- **Persistent SSH Sessions** - Named SSH connections that maintain state across commands
- **Real-time Terminal Monitoring** - Browser interface with live terminal output via WebSocket
- **Multi-Session Support** - Manage multiple independent SSH sessions simultaneously
- **Command History** - Track executed commands with timestamps and exit codes
- **Session Isolation** - Each session maintains separate terminal history and state

## Installation & Setup

### Prerequisites

- Node.js 16+ and npm
- SSH server access (for remote connections)
- TypeScript (for development)

### 1. Clone and Install

```bash
git clone <repository-url> ls-ssh-mcp
cd ls-ssh-mcp
npm install
npm run build
```

### 2. Install MCP Server

```bash
# Use the installation script (recommended)
./install-mcp.sh

# Or manually add to Claude Code
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js
```

The installation script handles port discovery, process cleanup, and configuration automatically.

## Usage

### Available MCP Tools

The server provides 5 MCP tools:

- `ssh_connect` - Establish SSH connection (requires name, host, username, password/privateKey)
- `ssh_exec` - Execute commands on remote server (requires sessionName, command)
- `ssh_list_sessions` - List all active SSH sessions
- `ssh_get_monitoring_url` - Get browser monitoring URL for a session
- `ssh_disconnect` - Disconnect an SSH session

### Web Monitoring Interface

Use `ssh_get_monitoring_url` to get a browser URL for real-time terminal monitoring. The interface displays command history and live output via WebSocket connection.

## Configuration

### Environment Variables

- `SSH_TIMEOUT` - SSH operation timeout in milliseconds (default: 30000)
- `MAX_SESSIONS` - Maximum concurrent SSH sessions (default: 10)
- `LOG_LEVEL` - Logging level: 'error', 'warn', 'info', 'debug' (default: 'info')

Web server port is automatically discovered and managed by the installation script.

## Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run E2E tests (requires SSH server on localhost)
npm run test:e2e

# Build for production
npm run build

# Lint code
npm run lint
```

### Testing Requirements

For running tests, you need:

- SSH server running on localhost
- Test user account: `test_user` with password `password123`
- Or configure your own test credentials in the test files

### Project Structure

```
├── src/
│   ├── mcp-server.ts              # Main server orchestrator
│   ├── mcp-ssh-server.ts          # MCP protocol handler
│   ├── web-server-manager.ts      # Web interface server
│   ├── ssh-connection-manager.ts  # SSH session management
│   └── types.ts                   # TypeScript definitions
├── static/                        # xterm.js terminal interface
├── install-mcp.sh                 # Installation script
└── dist/                          # Compiled output
```

## Security Considerations

- SSH sessions are kept in memory only
- Credentials are not persisted
- Web interface runs on localhost by default
- Use SSH key authentication when possible

## Architecture

The server runs two components in the same process:

- **MCP Server**: Communicates with Claude Code via stdio protocol
- **Web Server**: Provides browser interface via HTTP and WebSocket on auto-discovered port

Sessions are shared between both components for unified SSH management.

## License

MIT License - see [LICENSE](LICENSE) file for details.
