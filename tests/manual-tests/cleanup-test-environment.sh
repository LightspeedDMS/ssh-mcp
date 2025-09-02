#!/bin/bash

# SSH Key File Authentication Test Environment Cleanup Script
# This script cleans up the test environment after manual e2e testing

set -e  # Exit on error

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}SSH Key File Authentication - Test Environment Cleanup${NC}"
echo "======================================================="
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Confirm cleanup
echo "This script will remove:"
echo "  - Test SSH keys from ~/ssh-test-keys"
echo "  - Authorized keys for test_user"
echo "  - Any SSH agent keys"
echo ""
read -p "Do you want to proceed with cleanup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup..."

# Remove test SSH keys
TEST_KEY_DIR="$HOME/ssh-test-keys"
if [ -d "$TEST_KEY_DIR" ]; then
    rm -rf "$TEST_KEY_DIR"
    print_status "Removed test SSH keys directory"
else
    print_info "Test SSH keys directory not found"
fi

# Backup and clear authorized_keys for test_user
if id "test_user" &>/dev/null; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    AUTH_KEYS="/home/test_user/.ssh/authorized_keys"
    
    if [ -f "$AUTH_KEYS" ]; then
        # Create backup
        sudo -u test_user cp "$AUTH_KEYS" "${AUTH_KEYS}.backup_${TIMESTAMP}" 2>/dev/null || true
        print_status "Created backup: ${AUTH_KEYS}.backup_${TIMESTAMP}"
        
        # Clear authorized_keys
        sudo -u test_user truncate -s 0 "$AUTH_KEYS" 2>/dev/null || true
        print_status "Cleared test_user's authorized_keys"
    else
        print_info "No authorized_keys file found for test_user"
    fi
else
    print_info "test_user account not found"
fi

# Clear SSH agent keys
if ssh-add -D 2>/dev/null; then
    print_status "Cleared SSH agent keys"
else
    print_info "No SSH agent running or no keys to clear"
fi

# Kill any hanging SSH processes for test_user
KILLED_COUNT=$(pkill -f "ssh.*test_user" 2>/dev/null || echo "0")
if [ "$KILLED_COUNT" != "0" ]; then
    print_status "Terminated hanging SSH processes"
else
    print_info "No hanging SSH processes found"
fi

# Check for MCP server process
if pgrep -f "ls-ssh-mcp" > /dev/null; then
    print_info "MCP server is still running. Stop it with Ctrl+C in its terminal"
else
    print_status "MCP server is not running"
fi

# Optional: Remove test_user account
echo ""
read -p "Do you want to remove the test_user account completely? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if id "test_user" &>/dev/null; then
        # Kill any processes owned by test_user
        sudo pkill -u test_user 2>/dev/null || true
        
        # Remove the user and home directory
        sudo userdel -r test_user 2>/dev/null
        print_status "Removed test_user account and home directory"
    else
        print_info "test_user account not found"
    fi
else
    print_info "test_user account retained"
fi

# Display summary
echo ""
echo "====================================================="
echo -e "${GREEN}Test environment cleanup complete!${NC}"
echo ""
echo "Cleanup Summary:"
echo "  ✓ Test SSH keys removed"
echo "  ✓ Authorized keys cleared (backup created)"
echo "  ✓ SSH agent keys cleared"
echo "  ✓ Hanging processes terminated"

if id "test_user" &>/dev/null; then
    echo "  ℹ test_user account still exists (password: password123)"
else
    echo "  ✓ test_user account removed"
fi

echo ""
echo "The test environment has been cleaned up."
echo "You can run setup-test-environment.sh to set it up again."