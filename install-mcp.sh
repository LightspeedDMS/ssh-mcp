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
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run this script from the ls-ssh-mcp project directory${NC}"
    echo "Expected to find package.json in current directory"
    exit 1
fi

# Check for TypeScript source files
if [ ! -f "src/mcp-server.ts" ]; then
    echo -e "${RED}Error: TypeScript source files not found${NC}"
    echo "Expected to find src/mcp-server.ts"
    exit 1
fi

# Check if node_modules exists, install if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependencies not found. Installing npm dependencies...${NC}"
    if ! npm install; then
        echo -e "${RED}Error: Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Build the project (compile TypeScript to JavaScript)
echo -e "${YELLOW}Building project (compiling TypeScript to JavaScript)...${NC}"
echo "  • Compiling TypeScript files with tsc"
echo "  • Copying static files to dist/"
if ! npm run build; then
    echo -e "${RED}Error: Failed to build project${NC}"
    echo "Make sure TypeScript is properly installed and configured"
    exit 1
fi

# Verify build output exists
if [ ! -f "dist/src/mcp-server.js" ]; then
    echo -e "${RED}Error: Build completed but dist/src/mcp-server.js not found${NC}"
    echo "Build may have failed silently"
    exit 1
fi

echo -e "${GREEN}✅ Project built successfully${NC}"

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

# Discover an available port using a simpler approach
echo -e "${YELLOW}Discovering available port...${NC}"

# Start with a preferred port and find an available one
DISCOVERED_PORT=8080
while netstat -ln 2>/dev/null | grep -q ":$DISCOVERED_PORT " || ss -ln 2>/dev/null | grep -q ":$DISCOVERED_PORT "; do
    DISCOVERED_PORT=$((DISCOVERED_PORT + 1))
    if [ $DISCOVERED_PORT -gt 8200 ]; then
        echo -e "${RED}Error: Could not find available port in range 8080-8200${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Discovered available port: $DISCOVERED_PORT${NC}"

# Install the MCP server with the discovered port
echo -e "${YELLOW}Installing SSH MCP server with port $DISCOVERED_PORT...${NC}"

claude mcp add ssh node "$(pwd)/dist/src/mcp-server.js" -e WEB_PORT=$DISCOVERED_PORT

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 SSH MCP server installation completed successfully!${NC}"
    echo ""
    echo -e "${GREEN}What was completed:${NC}"
    echo "  ✅ TypeScript source files compiled to JavaScript"
    echo "  ✅ Static files (HTML, CSS, JS) copied to dist/"
    echo "  ✅ MCP server registered with Claude Code"
    echo "  ✅ Web terminal interface configured"
    echo "  ✅ Dynamic port discovery and assignment"
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
    echo -e "${GREEN}Installation complete! 🚀${NC}"
else
    echo -e "${RED}Error: Failed to install SSH MCP server${NC}"
    exit 1
fi