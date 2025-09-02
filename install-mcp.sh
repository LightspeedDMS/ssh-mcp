#!/bin/bash

# SSH MCP Server Installation Script
# This script discovers an available port and installs the MCP server with that port

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}SSH MCP Server Installation Script${NC}"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "dist/src/mcp-server.js" ]; then
    echo -e "${RED}Error: Must run this script from the ls-ssh-mcp project directory${NC}"
    echo "Make sure you've built the project with 'npm run build'"
    exit 1
fi

# Remove existing SSH MCP server if it exists
echo -e "${YELLOW}Removing existing SSH MCP server configuration...${NC}"
claude mcp remove ssh 2>/dev/null || true

# Kill any existing server processes to ensure clean state
echo -e "${YELLOW}Checking for existing server processes...${NC}"
EXISTING_PIDS=$(pgrep -f "node.*mcp-server.js" 2>/dev/null || true)
if [ -n "$EXISTING_PIDS" ]; then
    echo -e "${YELLOW}Found existing server processes, terminating them...${NC}"
    echo "$EXISTING_PIDS" | xargs -r kill -TERM 2>/dev/null || true
    sleep 2
    # Force kill if still running
    REMAINING_PIDS=$(pgrep -f "node.*mcp-server.js" 2>/dev/null || true)
    if [ -n "$REMAINING_PIDS" ]; then
        echo -e "${YELLOW}Force killing remaining processes...${NC}"
        echo "$REMAINING_PIDS" | xargs -r kill -KILL 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Cleaned up existing server processes${NC}"
fi

# Remove any existing port file
if [ -f ".ssh-mcp-server.port" ]; then
    echo -e "${YELLOW}Removing existing port file...${NC}"
    rm -f .ssh-mcp-server.port
fi

# Start the server briefly to discover the port
echo -e "${YELLOW}Discovering available port...${NC}"

# Run the orchestrator briefly to discover the port (pure MCP server doesn't output port info)
SERVER_OUTPUT=$(timeout 15s node dist/src/orchestrator.js 2>&1 | grep "MCP SSH Server started - MCP: stdio, Web:" || true)

if [ -z "$SERVER_OUTPUT" ]; then
    echo -e "${RED}Error: Failed to discover available port${NC}"
    echo -e "${RED}Server output (if any):${NC}"
    timeout 15s node dist/src/orchestrator.js 2>&1 | head -10 || true
    exit 1
fi

# Extract the port number from the output
DISCOVERED_PORT=$(echo "$SERVER_OUTPUT" | sed 's/.*Web: \([0-9]*\).*/\1/')

if [ -z "$DISCOVERED_PORT" ] || ! [[ "$DISCOVERED_PORT" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Could not parse discovered port from: $SERVER_OUTPUT${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Discovered available port: $DISCOVERED_PORT${NC}"

# Install the MCP server with the discovered port
echo -e "${YELLOW}Installing SSH MCP server with port $DISCOVERED_PORT...${NC}"

claude mcp add ssh node "$(pwd)/dist/src/mcp-server.js" -e WEB_PORT=$DISCOVERED_PORT

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSH MCP server installed successfully!${NC}"
    echo ""
    echo -e "${GREEN}Configuration:${NC}"
    echo "  • MCP Server: ssh"
    echo "  • Script: $(pwd)/dist/src/mcp-server.js"
    echo "  • Web Port: $DISCOVERED_PORT"
    echo "  • Monitoring URL: http://localhost:$DISCOVERED_PORT/session/{session-name}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Start using SSH tools in Claude Code (server starts automatically)"
    echo "2. Test SSH connection with your preferred host and credentials"
    echo "3. Use ssh_get_monitoring_url tool to get the specific monitoring URL"
    echo "4. Verify installation with: claude mcp list"
    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
else
    echo -e "${RED}Error: Failed to install SSH MCP server${NC}"
    exit 1
fi