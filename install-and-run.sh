#!/bin/bash

# SSH MCP Server Install and Run Script
# Finds open port, starts server permanently, registers with Claude Code

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}SSH MCP Server - Install and Run${NC}"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "dist/src/mcp-server.js" ]; then
    echo -e "${RED}Error: Must run this script from the ls-ssh-mcp project directory${NC}"
    echo "Make sure you've built the project with 'npm run build'"
    exit 1
fi

# Remove existing SSH MCP server if it exists
echo -e "${YELLOW}Removing any existing SSH MCP server configuration...${NC}"
claude mcp remove ssh 2>/dev/null || true

# Find an available port using Node.js directly (faster than starting full server)
echo -e "${YELLOW}Discovering available port...${NC}"
DISCOVERED_PORT=$(node -e "
const net = require('net');
function findAvailablePort(startPort = 8080) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer();
      server.listen(port, () => {
        const assignedPort = server.address()?.port;
        server.close(() => resolve(assignedPort));
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    }
    tryPort(startPort);
  });
}
findAvailablePort().then(console.log).catch(() => process.exit(1));
")

if [ -z "$DISCOVERED_PORT" ] || ! [[ "$DISCOVERED_PORT" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Failed to discover available port${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Discovered available port: $DISCOVERED_PORT${NC}"

# Kill any existing MCP server processes
echo -e "${YELLOW}Stopping any existing SSH MCP servers...${NC}"
pkill -f "ssh-mcp-persistent.js" 2>/dev/null || true
pkill -f "mcp-server.js" 2>/dev/null || true
sleep 2

# Create a persistent server script that handles BOTH MCP and web server
echo -e "${YELLOW}Creating unified persistent server...${NC}"
cat > ssh-mcp-unified.js << EOF
#!/usr/bin/env node

const { MCPSSHServer } = require('./dist/src/mcp-server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

async function main() {
  console.log('🚀 Starting Unified SSH MCP Server (MCP + Web)...');
  console.log('Port: $DISCOVERED_PORT');
  console.log('PID:', process.pid);
  
  const server = new MCPSSHServer({ webPort: $DISCOVERED_PORT });
  
  // Start BOTH web server AND MCP server together
  await server.start();
  console.log(\`📡 Web server + MCP server running on port $DISCOVERED_PORT\`);
  console.log(\`🌐 Monitoring available at: http://localhost:$DISCOVERED_PORT/session/{session-name}\`);
  console.log('📡 MCP server ready for stdio connections');
  
  // Log server ready
  console.log('✅ Unified SSH MCP Server ready for connections');
  console.log('💡 Server will run until manually stopped');
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Server error:', error.message);
  process.exit(1);
});
EOF

chmod +x ssh-mcp-unified.js

# Start the unified server in background
echo -e "${YELLOW}Starting unified SSH MCP server...${NC}"
nohup node ssh-mcp-unified.js > ssh-mcp-unified.log 2>&1 &
SERVER_PID=$!
sleep 3

# Verify server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Unified server started successfully (PID: $SERVER_PID)${NC}"
else
    echo -e "${RED}❌ Server failed to start${NC}"
    cat ssh-mcp-unified.log
    exit 1
fi

# Register with Claude Code to use the SAME unified server
echo -e "${YELLOW}Registering unified SSH MCP server with Claude Code...${NC}"
claude mcp add ssh node "$(pwd)/ssh-mcp-unified.js"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSH MCP server registered successfully!${NC}"
    echo ""
    echo -e "${GREEN}🎉 INSTALLATION COMPLETE! 🎉${NC}"
    echo ""
    echo -e "${GREEN}Server Information:${NC}"
    echo "  • Server PID: $SERVER_PID"
    echo "  • Web Port: $DISCOVERED_PORT" 
    echo "  • Log file: $(pwd)/ssh-mcp-server.log"
    echo "  • Monitoring URL: http://localhost:$DISCOVERED_PORT/session/{session-name}"
    echo ""
    echo -e "${YELLOW}Server Management:${NC}"
    echo "  • View logs: tail -f $(pwd)/ssh-mcp-server.log"
    echo "  • Stop server: kill $SERVER_PID"
    echo "  • Check status: kill -0 $SERVER_PID && echo 'Running' || echo 'Stopped'"
    echo ""
    echo -e "${GREEN}Next Steps:${NC}"
    echo "1. Server is running permanently in background"
    echo "2. Use SSH MCP tools in Claude Code (ssh_connect, ssh_exec, etc.)"
    echo "3. Monitor sessions at the web interface URLs"
    echo ""
    echo -e "${GREEN}Server will keep running until you manually stop it!${NC}"
    
    # Save server info for easy management
    echo "$SERVER_PID" > .ssh-mcp-server.pid
    echo "$DISCOVERED_PORT" > .ssh-mcp-server.port
    
else
    echo -e "${RED}❌ Failed to register SSH MCP server${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi