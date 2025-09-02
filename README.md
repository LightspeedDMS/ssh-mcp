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
- Claude Code CLI installed and configured
- SSH server access (for remote connections)
- TypeScript (for development)

### 1. Clone and Build

```bash
git clone <repository-url> ls-ssh-mcp
cd ls-ssh-mcp
npm install
npm run build
```

### 2. Register with Claude Code

```bash
# Use the installation script (recommended)
./install-mcp.sh

# Or manually register
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js
```

### 3. Verify Installation

```bash
# Check that the server was registered
claude mcp list
```

**How it works:**
- The `install-mcp.sh` script **registers** the server with Claude Code with an auto-discovered port
- Claude Code **automatically starts** the server when you use SSH tools
- No need to manually start/stop - the server runs on-demand
- Web monitoring interface is available at `http://localhost:{port}/session/{session-name}`

The installation script handles port discovery, cleanup of existing configurations, and proper registration.

## Usage

### Basic Workflow

1. **Connect to SSH server**: Use `ssh_connect` with your credentials
2. **Execute commands**: Use `ssh_exec` to run commands on the remote server  
3. **Monitor sessions**: Use `ssh_get_monitoring_url` to get browser monitoring URL
4. **Manage sessions**: Use `ssh_list_sessions` and `ssh_disconnect` as needed

### Available MCP Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `ssh_connect` | Establish SSH connection | `name`, `host`, `username`, `password`/`privateKey` |
| `ssh_exec` | Execute commands on remote server | `sessionName`, `command` |
| `ssh_list_sessions` | List all active SSH sessions | None |
| `ssh_get_monitoring_url` | Get browser monitoring URL | `sessionName` |
| `ssh_disconnect` | Disconnect an SSH session | `sessionName` |

### Example Usage

```bash
# 1. Connect to a server
ssh_connect name="myserver" host="example.com" username="user" password="pass"

# 2. Execute commands
ssh_exec sessionName="myserver" command="ls -la"
ssh_exec sessionName="myserver" command="htop"

# 3. Get monitoring URL for real-time terminal
ssh_get_monitoring_url sessionName="myserver"
# Returns: http://localhost:8082/session/myserver

# 4. List all active sessions
ssh_list_sessions

# 5. Disconnect when done
ssh_disconnect sessionName="myserver"
```

### Web Monitoring Interface

The browser interface provides:
- **Live terminal output** via WebSocket connection
- **Command history** with timestamps and exit codes
- **Real-time streaming** of command execution
- **Session-specific URLs** for each SSH connection

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

- **MCP Server**: Communicates with Claude Code via stdio protocol (no network port)
- **Web Server**: Provides browser interface via HTTP and WebSocket on auto-discovered port

### Port Management

- **MCP communication**: Uses stdio transport only (stdin/stdout with Claude Code)
- **Web interface**: Single auto-discovered port serves both HTTP routes and WebSocket connections
- **Port discovery**: Installation script discovers available port and stores as `WEB_PORT` environment variable for the MCP server process
- **Coordination**: Shared SSH session manager enables MCP tools to return monitoring URLs pointing to the web interface

### Deployment Modes

- **Production**: Claude Code automatically starts `mcp-server.js` on-demand when SSH tools are used
- **Development**: Manual testing via `orchestrator.js` with independent port discovery

Sessions are shared between both components for unified SSH management.

## Troubleshooting

### Common Issues

**Server not starting after registration:**
```bash
# Check if Claude Code recognizes the server
claude mcp list

# Verify build exists
ls -la dist/src/mcp-server.js

# Test the server directly
node dist/src/mcp-server.js
```

**Port conflicts:**
```bash
# Re-run installation to discover new port
./install-mcp.sh

# Verify new configuration
claude mcp get ssh
```

**SSH connection failures:**
- Verify SSH server is running and accessible
- Check credentials (username/password or privateKey)
- Ensure SSH server allows password authentication if using passwords

**Web interface not accessible:**
- Use `ssh_get_monitoring_url` to get the correct URL with current port
- Check that the server is running: `ps aux | grep mcp-server`

### Logs and Debugging

```bash
# Enable debug logging when using Claude Code
export LOG_LEVEL=debug

# Check MCP server configuration
claude mcp get ssh

# Test server manually with debug output
LOG_LEVEL=debug node dist/src/mcp-server.js
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
