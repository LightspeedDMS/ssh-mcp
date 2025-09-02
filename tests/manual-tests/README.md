# SSH Key File Authentication - Manual E2E Testing

This directory contains comprehensive manual end-to-end testing resources for validating the SSH key file authentication enhancement.

## Overview

The SSH key file authentication enhancement adds `keyFilePath` and `passphrase` parameters to the `ssh_connect` tool, allowing users to specify SSH key file paths instead of pasting key content directly. This test suite validates the feature works correctly with real SSH infrastructure.

## Test Resources

### 1. Test Plan Document
**File:** `ssh-key-file-e2e-test-plan.md`
- Comprehensive test plan with 12 test cases
- Detailed setup instructions
- Success criteria and failure indicators
- Troubleshooting guide
- Test execution tracking template

### 2. Setup Script
**File:** `setup-test-environment.sh`
- Automated environment setup
- Creates test SSH keys (RSA and ED25519)
- Configures test_user account
- Sets up authorized_keys
- Validates SSH connectivity

**Usage:**
```bash
./setup-test-environment.sh
```

### 3. Quick Validation Script
**File:** `quick-validation-test.sh`
- Automated basic validation tests
- Tests key authentication scenarios
- Provides pass/fail results
- Good for smoke testing

**Usage:**
```bash
# Ensure MCP server is running first
./quick-validation-test.sh
```

### 4. Interactive Test Client
**File:** `test-client.js`
- Node.js-based test client
- Interactive and automated modes
- Tests all authentication scenarios
- Custom connection testing

**Usage:**
```bash
# Interactive mode
node test-client.js

# Automated test run
node test-client.js --auto
```

### 5. Cleanup Script
**File:** `cleanup-test-environment.sh`
- Removes test SSH keys
- Clears authorized_keys
- Optional test_user removal
- Creates backups before cleanup

**Usage:**
```bash
./cleanup-test-environment.sh
```

## Quick Start Guide

### 1. Initial Setup
```bash
# Navigate to manual tests directory
cd /home/jsbattig/Dev/ls-ssh-mcp/tests/manual-tests

# Run setup script
./setup-test-environment.sh
```

### 2. Start MCP Server
```bash
# In a separate terminal
cd /home/jsbattig/Dev/ls-ssh-mcp
npm run build
npm start
```

### 3. Run Tests

#### Option A: Quick Validation
```bash
./quick-validation-test.sh
```

#### Option B: Interactive Testing
```bash
node test-client.js
# Then follow the interactive prompts
```

#### Option C: Automated Full Test
```bash
node test-client.js --auto
```

#### Option D: Manual Test Plan
Follow the detailed test cases in `ssh-key-file-e2e-test-plan.md`

### 4. Cleanup
```bash
./cleanup-test-environment.sh
```

## Test Environment Details

### Test User
- Username: `test_user`
- Password: `password123`
- Home: `/home/test_user`

### Test SSH Keys
Located in `~/ssh-test-keys/`:

| Key Type | File | Passphrase |
|----------|------|------------|
| RSA Unencrypted | `valid/test_rsa_unencrypted` | None |
| RSA Encrypted | `valid/test_rsa_encrypted` | `testpass123` |
| ED25519 Unencrypted | `valid/test_ed25519_unencrypted` | None |
| ED25519 Encrypted | `valid/test_ed25519_encrypted` | `secure456` |
| Invalid Key | `invalid/not_a_key` | N/A |
| Restricted | `restricted/test_rsa_restricted` | N/A |

### MCP Server Endpoints
- MCP RPC: `http://localhost:3000/rpc`
- WebSocket: `ws://localhost:8080`
- Health: `http://localhost:3000/health`

## Test Scenarios Covered

1. ✅ Unencrypted RSA key authentication
2. ✅ Encrypted RSA key with passphrase
3. ✅ ED25519 key support
4. ✅ Path traversal security validation
5. ✅ Invalid key file handling
6. ✅ Wrong passphrase handling
7. ✅ Backward compatibility (privateKey parameter)
8. ✅ Priority testing (privateKey vs keyFilePath)
9. ✅ Tilde expansion validation
10. ✅ Concurrent connections with different keys
11. ✅ Performance and load testing
12. ✅ Error recovery and cleanup

## Troubleshooting

### Common Issues

#### MCP Server Not Running
```bash
cd /home/jsbattig/Dev/ls-ssh-mcp
npm run build
npm start
```

#### SSH Authentication Failures
```bash
# Check SSH service
sudo systemctl status ssh

# Check logs
sudo journalctl -u ssh -n 50

# Verify keys
ls -la ~/ssh-test-keys/valid/
```

#### Permission Issues
```bash
# Fix SSH directory permissions
sudo -u test_user chmod 700 /home/test_user/.ssh
sudo -u test_user chmod 600 /home/test_user/.ssh/authorized_keys
```

## Success Criteria

The enhancement is validated when:
- All test cases pass successfully
- No security vulnerabilities detected
- Performance meets expectations (<2s connection time)
- Backward compatibility maintained
- Error handling works correctly
- No memory leaks or resource issues

## Additional Resources

- Main test plan: `ssh-key-file-e2e-test-plan.md`
- Project README: `/home/jsbattig/Dev/ls-ssh-mcp/README.md`
- Implementation: `/home/jsbattig/Dev/ls-ssh-mcp/src/ssh-connection-manager.ts`

## Notes

- All tests use real SSH infrastructure (no mocking)
- Tests run against localhost SSH server
- Requires sudo access for test_user configuration
- Tests are idempotent and can be run multiple times