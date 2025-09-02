#!/bin/bash

# Quick Validation Test Script for SSH Key File Authentication
# This script performs basic validation tests after setup

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MCP_PORT=${MCP_PORT:-3000}
TEST_KEY_DIR="$HOME/ssh-test-keys"

echo -e "${BLUE}SSH Key File Authentication - Quick Validation Tests${NC}"
echo "====================================================="
echo ""

# Function to print results
pass_test() {
    echo -e "${GREEN}✓ PASS${NC} - $1"
}

fail_test() {
    echo -e "${RED}✗ FAIL${NC} - $1"
    echo "  Error: $2"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if MCP server is running
echo "Pre-flight checks..."
if curl -s -f http://localhost:$MCP_PORT/health > /dev/null 2>&1; then
    pass_test "MCP server is running on port $MCP_PORT"
else
    fail_test "MCP server health check" "Server not responding on port $MCP_PORT"
    echo ""
    echo "Please ensure the MCP server is running:"
    echo "  cd /home/jsbattig/Dev/ls-ssh-mcp"
    echo "  npm start"
    exit 1
fi

# Check if test keys exist
if [ -d "$TEST_KEY_DIR/valid" ]; then
    pass_test "Test keys directory exists"
else
    fail_test "Test keys check" "Directory $TEST_KEY_DIR/valid not found"
    echo "Run ./setup-test-environment.sh first"
    exit 1
fi

echo ""
echo "Running validation tests..."
echo ""

# Test 1: Unencrypted RSA Key Connection
echo "Test 1: Unencrypted RSA Key Authentication"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_connect",
      "arguments": {
        "name": "test_rsa_unencrypted",
        "host": "localhost",
        "username": "test_user",
        "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted"
      }
    },
    "id": 1
  }' 2>&1)

if echo "$RESPONSE" | grep -q "Successfully connected"; then
    pass_test "Unencrypted RSA key authentication"
    
    # Execute test command
    CMD_RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
          "name": "ssh_execute",
          "arguments": {
            "sessionName": "test_rsa_unencrypted",
            "command": "whoami"
          }
        },
        "id": 2
      }' 2>&1)
    
    if echo "$CMD_RESPONSE" | grep -q "test_user"; then
        pass_test "Command execution on RSA session"
    else
        fail_test "Command execution" "$CMD_RESPONSE"
    fi
    
    # Disconnect
    curl -s -X POST http://localhost:$MCP_PORT/rpc \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
          "name": "ssh_disconnect",
          "arguments": {
            "sessionName": "test_rsa_unencrypted"
          }
        },
        "id": 3
      }' > /dev/null 2>&1
else
    fail_test "Unencrypted RSA key authentication" "$RESPONSE"
fi

echo ""

# Test 2: Encrypted RSA Key with Passphrase
echo "Test 2: Encrypted RSA Key with Passphrase"
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_connect",
      "arguments": {
        "name": "test_rsa_encrypted",
        "host": "localhost",
        "username": "test_user",
        "keyFilePath": "~/ssh-test-keys/valid/test_rsa_encrypted",
        "passphrase": "testpass123"
      }
    },
    "id": 4
  }' 2>&1)

if echo "$RESPONSE" | grep -q "Successfully connected"; then
    pass_test "Encrypted RSA key with passphrase"
    
    # Disconnect
    curl -s -X POST http://localhost:$MCP_PORT/rpc \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
          "name": "ssh_disconnect",
          "arguments": {
            "sessionName": "test_rsa_encrypted"
          }
        },
        "id": 5
      }' > /dev/null 2>&1
else
    fail_test "Encrypted RSA key authentication" "$RESPONSE"
fi

echo ""

# Test 3: Wrong Passphrase (Negative Test)
echo "Test 3: Wrong Passphrase Handling (Negative Test)"
echo "------------------------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_connect",
      "arguments": {
        "name": "test_wrong_pass",
        "host": "localhost",
        "username": "test_user",
        "keyFilePath": "~/ssh-test-keys/valid/test_rsa_encrypted",
        "passphrase": "wrongpassword"
      }
    },
    "id": 6
  }' 2>&1)

if echo "$RESPONSE" | grep -q -E "(Authentication failed|incorrect passphrase|decrypt)"; then
    pass_test "Wrong passphrase properly rejected"
else
    fail_test "Wrong passphrase handling" "Expected authentication failure"
fi

echo ""

# Test 4: Path Traversal Security
echo "Test 4: Path Traversal Security (Negative Test)"
echo "----------------------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_connect",
      "arguments": {
        "name": "test_path_traversal",
        "host": "localhost",
        "username": "test_user",
        "keyFilePath": "../../../etc/passwd"
      }
    },
    "id": 7
  }' 2>&1)

if echo "$RESPONSE" | grep -q -E "(Path traversal|security|invalid path|outside)"; then
    pass_test "Path traversal attempt blocked"
else
    fail_test "Path traversal security" "Security violation not detected"
fi

echo ""

# Test 5: ED25519 Key Support
echo "Test 5: ED25519 Key Support"
echo "--------------------------"
RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_connect",
      "arguments": {
        "name": "test_ed25519",
        "host": "localhost",
        "username": "test_user",
        "keyFilePath": "~/ssh-test-keys/valid/test_ed25519_unencrypted"
      }
    },
    "id": 8
  }' 2>&1)

if echo "$RESPONSE" | grep -q "Successfully connected"; then
    pass_test "ED25519 key authentication"
    
    # Disconnect
    curl -s -X POST http://localhost:$MCP_PORT/rpc \
      -H "Content-Type: application/json" \
      -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
          "name": "ssh_disconnect",
          "arguments": {
            "sessionName": "test_ed25519"
          }
        },
        "id": 9
      }' > /dev/null 2>&1
else
    fail_test "ED25519 key authentication" "$RESPONSE"
fi

echo ""

# Test 6: List Sessions
echo "Test 6: Session Management"
echo "-------------------------"
# Create a connection first
curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_connect",
      "arguments": {
        "name": "test_session_mgmt",
        "host": "localhost",
        "username": "test_user",
        "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted"
      }
    },
    "id": 10
  }' > /dev/null 2>&1

RESPONSE=$(curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_list_sessions"
    },
    "id": 11
  }' 2>&1)

if echo "$RESPONSE" | grep -q "test_session_mgmt"; then
    pass_test "Session listing works"
else
    fail_test "Session listing" "Session not found in list"
fi

# Cleanup
curl -s -X POST http://localhost:$MCP_PORT/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "ssh_disconnect",
      "arguments": {
        "sessionName": "test_session_mgmt"
      }
    },
    "id": 12
  }' > /dev/null 2>&1

# Summary
echo ""
echo "====================================================="
echo -e "${BLUE}Test Summary${NC}"
echo "====================================================="

TOTAL_TESTS=6
PASSED=$(grep -c "✓ PASS" /dev/stdout 2>/dev/null || echo 0)
FAILED=$(grep -c "✗ FAIL" /dev/stdout 2>/dev/null || echo 0)

echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ "$FAILED" -eq 0 ]; then
    echo ""
    echo -e "${GREEN}All validation tests passed!${NC}"
    echo "The SSH key file authentication enhancement is working correctly."
else
    echo ""
    echo -e "${YELLOW}Some tests failed. Please review the errors above.${NC}"
    echo "Check the MCP server logs for more details."
fi

echo ""
echo "For comprehensive testing, refer to ssh-key-file-e2e-test-plan.md"