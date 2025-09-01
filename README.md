# SSH MCP Server

A Model Context Protocol (MCP) server that provides persistent SSH session management for Claude Code, enabling distributed development workflows with real-time monitoring capabilities.

## Features

- 🔐 **Persistent SSH Sessions** - Create and manage named SSH connections that persist across commands
- 🖥️ **Real-time Terminal Monitoring** - Browser-based interface with live terminal output streaming
- 📊 **Multi-Session Dashboard** - Monitor multiple SSH sessions simultaneously with status indicators
- 🎯 **Interactive Terminal Controls** - Send commands, handle interrupts (Ctrl+C, Ctrl+D, Ctrl+Z), resize terminal
- 📜 **Command History Tracking** - Track executed commands with timestamps, duration, and exit codes
- 🔄 **Robust Connectivity Management** - Automatic reconnection with exponential backoff
- 🌐 **Web Interface Integration** - Full-featured browser monitoring with WebSocket communication

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

### 2. Install in Claude Code

Use Claude Code's built-in MCP management commands to add the server:

```bash
# Add the SSH MCP server (simple)
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js

# Add with environment variables (recommended) 
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js -e WEB_PORT=8080

# Add with multiple environment variables
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js -e WEB_PORT=8080 -e SSH_TIMEOUT=60 -e LOG_LEVEL=info

# Add with project scope (only for this project)
claude mcp add --scope project ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js -e WEB_PORT=8080

# Verify the server was added
claude mcp list

# Check server details
claude mcp get ssh
```

### 3. Test the Installation

Start Claude Code and verify the SSH tools are available:

```bash
# The server should automatically load when Claude Code starts
# You can check if it's working by asking Claude Code:
# "What MCP tools do you have available?"
```

## Usage

### Available MCP Tools

The server provides 5 MCP tools that Claude Code can use:

#### 1. `ssh_connect`
Establish an SSH connection to a remote server:

```typescript
// Claude Code will use this tool like:
await mcp.callTool('ssh_connect', {
  name: 'my-server',
  host: 'example.com',
  username: 'user',
  password: 'password'  // or privateKey: '...'
});
```

#### 2. `ssh_exec`
Execute commands on the remote server:

```typescript
await mcp.callTool('ssh_exec', {
  sessionName: 'my-server',
  command: 'ls -la',
  timeout: 30000  // optional
});
```

#### 3. `ssh_list_sessions`
List all active SSH sessions:

```typescript
await mcp.callTool('ssh_list_sessions', {});
```

#### 4. `ssh_get_monitoring_url`
Get browser monitoring URL for a session:

```typescript
await mcp.callTool('ssh_get_monitoring_url', {
  sessionName: 'my-server'
});
```

#### 5. `ssh_disconnect`
Disconnect an SSH session:

```typescript
await mcp.callTool('ssh_disconnect', {
  sessionName: 'my-server'
});
```

### Web Monitoring Interface

Once you have active SSH sessions, you can monitor them in your browser:

1. Get the monitoring URL using `ssh_get_monitoring_url`
2. Open the URL in your browser (e.g., `http://localhost:8080/session/my-server`)
3. View real-time terminal output, command history, and session status

## Example Workflow

Here's a typical distributed development workflow using Claude Code with the SSH MCP server:

### 1. Connect to Remote Development Server

```
Claude, please connect to my development server:
- Host: dev.mycompany.com  
- Username: developer
- Use my SSH key authentication
```

Claude Code will use `ssh_connect` to establish the connection.

### 2. Execute Development Commands

```
Claude, please run the following on the development server:
1. Check the current directory
2. Pull the latest code from git
3. Run the test suite
4. Check the application logs
```

Claude Code will use `ssh_exec` for each command, maintaining the persistent session.

### 3. Monitor in Browser

```
Claude, please give me the monitoring URL for this session so I can watch the output in real-time.
```

Claude Code will use `ssh_get_monitoring_url` to provide a browser link.

### 4. Manage Multiple Sessions

```
Claude, please also connect to the staging server and production server so we can compare configurations across environments.
```

Claude Code will create multiple sessions that you can monitor simultaneously.

## Configuration

### Environment Variables

- `WEB_PORT` - Port for the web monitoring interface (default: 8080)
- `SSH_TIMEOUT` - SSH operation timeout in seconds (default: 30)
- `MAX_SESSIONS` - Maximum concurrent SSH sessions (default: 10)
- `LOG_LEVEL` - Logging level: 'error', 'warn', 'info', 'debug' (default: 'info')

### Advanced Configuration

You can customize the server behavior using environment variables:

```bash
# Remove existing configuration  
claude mcp remove ssh

# Add with custom configuration (cleaner syntax)
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js \
  -e WEB_PORT=3000 \
  -e SSH_TIMEOUT=60 \
  -e MAX_SESSIONS=20 \
  -e LOG_LEVEL=debug

# Add with user scope (available in all projects)
claude mcp add --scope user ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js \
  -e WEB_PORT=8080 \
  -e LOG_LEVEL=info

# Add with project scope (only this project)
claude mcp add --scope project ssh node ./dist/src/mcp-server.js \
  -e WEB_PORT=3001
```

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
│   ├── mcp-server.ts          # Main MCP server implementation
│   ├── ssh-connection-manager.ts  # SSH connection management
│   ├── web-server-manager.ts      # Web interface server
│   └── types.ts               # TypeScript type definitions
├── static/
│   ├── index.html             # Web monitoring interface
│   ├── app.js                 # Frontend JavaScript
│   └── styles.css             # Interface styling
├── tests/                     # Comprehensive test suite
└── dist/                      # Compiled JavaScript output
```

## Security Considerations

- **SSH Keys**: Use SSH key authentication when possible instead of passwords
- **Network Access**: The web interface runs on localhost by default - configure firewall rules appropriately for remote access
- **Session Management**: Sessions are kept in memory - restart the server to clear all sessions
- **Credentials**: Credentials are not persisted - you'll need to reconnect after server restarts

## Troubleshooting

### Common Issues

**1. "Port already in use" error:**
```bash
# Change the web port in your configuration
"WEB_PORT": "8081"
```

**2. SSH connection timeouts:**
```bash
# Increase the SSH timeout
"SSH_TIMEOUT": "60"
```

**3. Can't connect to monitoring URL:**
- Check that the web server started successfully
- Verify the port is not blocked by firewall
- Ensure you're using the correct URL format: `http://localhost:PORT/session/SESSION_NAME`

**4. Commands hang or timeout:**
- Check SSH server connectivity
- Verify user credentials and permissions
- Check if commands require interactive input

### Debug Mode

Enable debug logging for troubleshooting:

```json
{
  "env": {
    "LOG_LEVEL": "debug"
  }
}
```

### Test Connection

Test your SSH MCP server setup:

```bash
# Check if the MCP server is configured
claude mcp list

# Get details about the ssh server
claude mcp get ssh

# Test the server starts correctly (manual test)
WEB_PORT=8080 node dist/src/mcp-server.js

# Test SSH connectivity (if you have test credentials)
npm run test:e2e
```

### MCP Server Management

Common MCP management commands:

```bash
# List all configured MCP servers
claude mcp list

# Get details about a specific server
claude mcp get ssh

# Remove the SSH server
claude mcp remove ssh

# Re-add the SSH server with environment variables
claude mcp add ssh node /absolute/path/to/ls-ssh-mcp/dist/src/mcp-server.js -e WEB_PORT=8080

# Add with different scopes
claude mcp add --scope user ssh node /path/to/server.js     # Available in all projects
claude mcp add --scope project ssh node ./dist/server.js   # Only this project
claude mcp add --scope local ssh node /path/to/server.js   # Default scope

# Import from Claude Desktop (Mac/WSL only)
claude mcp add-from-claude-desktop

# Reset project-scoped servers
claude mcp reset-project-choices
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run the test suite: `npm test`
5. Submit a pull request

## License

[Add your license information here]

---

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the comprehensive test suite for usage examples

Built with ❤️ for distributed development with Claude Code.