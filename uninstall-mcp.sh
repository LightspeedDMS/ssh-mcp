#!/bin/bash

# SSH MCP Server Uninstallation Script
# This script removes the MCP server configuration and cleans up all related files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}SSH MCP Server Uninstallation Script${NC}"
echo "========================================="

# Confirmation prompt
echo -e "${YELLOW}This will completely remove the SSH MCP server:${NC}"
echo "  • Remove MCP server configuration from Claude Code"
echo "  • Terminate any running server processes"
echo "  • Remove compiled JavaScript files (dist/ directory)"
echo "  • Clean up port files and temporary data"
echo ""
read -p "Are you sure you want to uninstall? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Uninstallation cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting uninstallation...${NC}"

# Remove MCP server configuration
echo -e "${YELLOW}Removing SSH MCP server configuration...${NC}"
if claude mcp remove ssh 2>/dev/null; then
    echo -e "${GREEN}✅ SSH MCP server configuration removed${NC}"
else
    echo -e "${YELLOW}ℹ️ SSH MCP server was not registered or already removed${NC}"
fi

# Kill any running server processes
echo -e "${YELLOW}Terminating running server processes...${NC}"
EXISTING_PIDS=$(pgrep -f "node.*mcp-server.js" 2>/dev/null || true)
if [ -n "$EXISTING_PIDS" ]; then
    echo -e "${YELLOW}Found running server processes, terminating...${NC}"
    echo "$EXISTING_PIDS" | xargs -r kill -TERM 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    REMAINING_PIDS=$(pgrep -f "node.*mcp-server.js" 2>/dev/null || true)
    if [ -n "$REMAINING_PIDS" ]; then
        echo -e "${YELLOW}Force killing remaining processes...${NC}"
        echo "$REMAINING_PIDS" | xargs -r kill -KILL 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Server processes terminated${NC}"
else
    echo -e "${GREEN}ℹ️ No running server processes found${NC}"
fi

# Kill any orchestrator processes
ORCHESTRATOR_PIDS=$(pgrep -f "node.*orchestrator.js" 2>/dev/null || true)
if [ -n "$ORCHESTRATOR_PIDS" ]; then
    echo -e "${YELLOW}Terminating orchestrator processes...${NC}"
    echo "$ORCHESTRATOR_PIDS" | xargs -r kill -TERM 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✅ Orchestrator processes terminated${NC}"
fi

# Remove compiled files
if [ -d "dist" ]; then
    echo -e "${YELLOW}Removing compiled files (dist/ directory)...${NC}"
    rm -rf dist
    echo -e "${GREEN}✅ Compiled files removed${NC}"
else
    echo -e "${GREEN}ℹ️ No compiled files found${NC}"
fi

# Remove port file
if [ -f ".ssh-mcp-server.port" ]; then
    echo -e "${YELLOW}Removing port configuration file...${NC}"
    rm -f .ssh-mcp-server.port
    echo -e "${GREEN}✅ Port configuration file removed${NC}"
fi

# Optional: Remove node_modules (ask user)
if [ -d "node_modules" ]; then
    echo ""
    read -p "Do you want to remove node_modules/ (can be reinstalled with 'npm install')? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing node_modules...${NC}"
        rm -rf node_modules
        echo -e "${GREEN}✅ Node modules removed${NC}"
    else
        echo -e "${GREEN}ℹ️ Node modules retained${NC}"
    fi
fi

# Verify removal
echo ""
echo -e "${YELLOW}Verifying uninstallation...${NC}"

# Check MCP registration
if claude mcp list 2>/dev/null | grep -q "ssh:"; then
    echo -e "${RED}⚠️ SSH MCP server still appears in configuration${NC}"
else
    echo -e "${GREEN}✅ SSH MCP server removed from configuration${NC}"
fi

# Check for running processes
if pgrep -f "mcp-server.js" > /dev/null; then
    echo -e "${RED}⚠️ Server processes still running${NC}"
else
    echo -e "${GREEN}✅ No server processes running${NC}"
fi

# Check for compiled files
if [ -d "dist" ]; then
    echo -e "${RED}⚠️ Compiled files still present${NC}"
else
    echo -e "${GREEN}✅ Compiled files removed${NC}"
fi

# Final summary
echo ""
echo "=============================================="
echo -e "${GREEN}🎉 SSH MCP Server Uninstallation Complete!${NC}"
echo ""
echo -e "${GREEN}What was removed:${NC}"
echo "  ✅ MCP server configuration from Claude Code"
echo "  ✅ All running server processes terminated"
echo "  ✅ Compiled JavaScript files (dist/ directory)"
echo "  ✅ Port configuration files"
if [ ! -d "node_modules" ]; then
    echo "  ✅ Node.js dependencies (node_modules/)"
fi
echo ""
echo -e "${YELLOW}Source files retained:${NC}"
echo "  • TypeScript source files (src/)"
echo "  • Static assets (static/)"
echo "  • Configuration files (package.json, tsconfig.json)"
echo "  • Documentation and tests"
echo ""
echo -e "${GREEN}To reinstall: Run ./install-mcp.sh${NC}"
echo -e "${GREEN}To clean everything: Delete the entire project directory${NC}"