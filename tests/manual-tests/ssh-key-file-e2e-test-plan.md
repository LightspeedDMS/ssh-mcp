# SSH Key File Authentication Enhancement - End-to-End Manual Test Plan

## Test Overview
This test plan validates the SSH key file authentication enhancement that adds `keyFilePath` and `passphrase` parameters to the `ssh_connect` tool. The tests verify real SSH connections using both encrypted and unencrypted SSH keys against localhost infrastructure.

## Environment Setup

### Prerequisites
- Ubuntu/Linux system with SSH server installed and running
- Node.js and npm installed
- ls-ssh-mcp server built and ready to run
- SSH server configured to accept both password and key authentication
- Test user account: `test_user` with password `password123` (already configured)

### Test Infrastructure Setup

#### 1. Create Test Directory Structure
```bash
# Create dedicated test environment
mkdir -p ~/ssh-test-keys/valid
mkdir -p ~/ssh-test-keys/invalid
mkdir -p ~/ssh-test-keys/restricted
chmod 700 ~/ssh-test-keys
```

#### 2. Generate SSH Key Pairs for Testing
```bash
# Generate unencrypted RSA key
ssh-keygen -t rsa -b 2048 -f ~/ssh-test-keys/valid/test_rsa_unencrypted -N "" -C "test_rsa_unencrypted"

# Generate encrypted RSA key with passphrase "testpass123"
ssh-keygen -t rsa -b 2048 -f ~/ssh-test-keys/valid/test_rsa_encrypted -N "testpass123" -C "test_rsa_encrypted"

# Generate unencrypted ED25519 key
ssh-keygen -t ed25519 -f ~/ssh-test-keys/valid/test_ed25519_unencrypted -N "" -C "test_ed25519_unencrypted"

# Generate encrypted ED25519 key with passphrase "secure456"
ssh-keygen -t ed25519 -f ~/ssh-test-keys/valid/test_ed25519_encrypted -N "secure456" -C "test_ed25519_encrypted"

# Create invalid key file for negative testing
echo "INVALID SSH KEY CONTENT" > ~/ssh-test-keys/invalid/not_a_key

# Set restricted permissions for permission test
cp ~/ssh-test-keys/valid/test_rsa_unencrypted ~/ssh-test-keys/restricted/test_rsa_restricted
chmod 000 ~/ssh-test-keys/restricted/test_rsa_restricted
```

#### 3. Configure SSH Server for Key Authentication
```bash
# Add public keys to authorized_keys for test_user
sudo -u test_user mkdir -p /home/test_user/.ssh
sudo -u test_user chmod 700 /home/test_user/.ssh
sudo -u test_user touch /home/test_user/.ssh/authorized_keys
sudo -u test_user chmod 600 /home/test_user/.ssh/authorized_keys

# Add all test public keys
sudo -u test_user bash -c 'cat ~/ssh-test-keys/valid/test_rsa_unencrypted.pub >> /home/test_user/.ssh/authorized_keys'
sudo -u test_user bash -c 'cat ~/ssh-test-keys/valid/test_rsa_encrypted.pub >> /home/test_user/.ssh/authorized_keys'
sudo -u test_user bash -c 'cat ~/ssh-test-keys/valid/test_ed25519_unencrypted.pub >> /home/test_user/.ssh/authorized_keys'
sudo -u test_user bash -c 'cat ~/ssh-test-keys/valid/test_ed25519_encrypted.pub >> /home/test_user/.ssh/authorized_keys'

# Verify SSH server configuration allows key authentication
sudo grep -E "PubkeyAuthentication|AuthorizedKeysFile" /etc/ssh/sshd_config
# Expected: PubkeyAuthentication yes
```

#### 4. Start MCP SSH Server
```bash
# Navigate to project directory
cd /home/jsbattig/Dev/ls-ssh-mcp

# Build the project
npm run build

# Start the MCP server (keep this running in a terminal)
npm start
# Expected: Server starts on port 3000 (MCP) and 8080 (WebSocket)
```

## Test Cases

### Test Case 1: Unencrypted RSA Key Authentication
**Objective**: Verify successful SSH connection using unencrypted RSA key file path

**Preconditions**:
- MCP server is running
- SSH keys are generated and configured
- test_user account exists with authorized_keys configured

**Execution Steps**:
1. Connect to MCP server using client tool
2. Execute ssh_connect with keyFilePath parameter:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "test_rsa_unencrypted",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted"
     }
   }
   ```
3. Verify connection response contains:
   - `success: true`
   - `message` containing "Successfully connected"
   - Session name "test_rsa_unencrypted"
4. Execute a test command to verify connection:
   ```json
   {
     "tool": "ssh_execute",
     "arguments": {
       "sessionName": "test_rsa_unencrypted",
       "command": "whoami && hostname && echo 'Connection successful'"
     }
   }
   ```
5. Verify command output:
   - stdout contains "test_user"
   - stdout contains hostname
   - stdout contains "Connection successful"
   - exitCode is 0

**Success Criteria**:
- Connection established without password prompt
- Commands execute successfully through the connection
- No errors in server logs
- Connection status shows "connected"

**Failure Indicators**:
- Authentication failure messages
- Connection timeout
- "Permission denied" errors
- Server crashes or hangs

**Cleanup**:
```json
{
  "tool": "ssh_disconnect",
  "arguments": {
    "sessionName": "test_rsa_unencrypted"
  }
}
```

### Test Case 2: Encrypted RSA Key with Passphrase
**Objective**: Verify successful SSH connection using encrypted RSA key with correct passphrase

**Preconditions**:
- Previous test cleanup completed
- MCP server is running

**Execution Steps**:
1. Execute ssh_connect with keyFilePath and passphrase:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "test_rsa_encrypted",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_encrypted",
       "passphrase": "testpass123"
     }
   }
   ```
2. Verify successful connection response
3. Execute verification command:
   ```json
   {
     "tool": "ssh_execute",
     "arguments": {
       "sessionName": "test_rsa_encrypted",
       "command": "ls -la ~/.ssh/authorized_keys"
     }
   }
   ```
4. Verify file listing shows authorized_keys with proper permissions

**Success Criteria**:
- Connection established with encrypted key
- Passphrase correctly decrypts the key
- Commands execute successfully
- No passphrase visible in logs

**Failure Indicators**:
- "Key is encrypted but no passphrase provided" error
- "incorrect passphrase" error
- Authentication failure

**Cleanup**:
```json
{
  "tool": "ssh_disconnect",
  "arguments": {
    "sessionName": "test_rsa_encrypted"
  }
}
```

### Test Case 3: ED25519 Key Support
**Objective**: Verify support for modern ED25519 key algorithm

**Preconditions**:
- Previous tests completed
- MCP server is running

**Execution Steps**:
1. Test unencrypted ED25519 key:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "test_ed25519",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_ed25519_unencrypted"
     }
   }
   ```
2. Verify connection and execute test command
3. Disconnect
4. Test encrypted ED25519 key:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "test_ed25519_encrypted",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_ed25519_encrypted",
       "passphrase": "secure456"
     }
   }
   ```
5. Verify connection and execute test command

**Success Criteria**:
- Both ED25519 keys work correctly
- Modern key algorithm properly supported
- Performance comparable to RSA keys

**Cleanup**:
Disconnect all sessions

### Test Case 4: Path Traversal Security Validation
**Objective**: Verify protection against path traversal attacks

**Preconditions**:
- MCP server is running
- Test keys exist in known locations

**Execution Steps**:
1. Attempt connection with path traversal pattern:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "path_traversal_test",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "../../../etc/passwd"
     }
   }
   ```
2. Verify error response contains security violation message
3. Attempt with null byte injection:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "null_byte_test",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted\u0000.pub"
     }
   }
   ```
4. Verify rejection with security error
5. Check server logs for security warnings

**Success Criteria**:
- All path traversal attempts blocked
- Clear security error messages returned
- No file system access outside allowed paths
- Security events logged

**Failure Indicators**:
- Successful file access outside home directory
- Server crash on malicious input
- Unclear error messages

### Test Case 5: Invalid Key File Handling
**Objective**: Verify graceful handling of invalid key files

**Preconditions**:
- Invalid test files created
- MCP server is running

**Execution Steps**:
1. Test non-existent file:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "nonexistent_key",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/does_not_exist"
     }
   }
   ```
   Expected: "ENOENT: no such file or directory" error
2. Test invalid key content:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "invalid_key",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/invalid/not_a_key"
     }
   }
   ```
   Expected: Authentication failure error
3. Test inaccessible file (permission denied):
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "restricted_key",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/restricted/test_rsa_restricted"
     }
   }
   ```
   Expected: "EACCES: permission denied" error

**Success Criteria**:
- Clear, specific error messages for each failure type
- No server crashes or hangs
- Appropriate error codes returned
- File system errors properly handled

### Test Case 6: Wrong Passphrase Handling
**Objective**: Verify proper handling of incorrect passphrases

**Preconditions**:
- Encrypted keys configured
- MCP server is running

**Execution Steps**:
1. Attempt connection with wrong passphrase:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "wrong_passphrase",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_encrypted",
       "passphrase": "wrongpassword"
     }
   }
   ```
2. Verify authentication failure error
3. Attempt with empty passphrase on encrypted key:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "missing_passphrase",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_encrypted"
     }
   }
   ```
4. Verify "Key is encrypted but no passphrase provided" error

**Success Criteria**:
- Clear error messages for passphrase issues
- No sensitive information leaked in errors
- Connection properly cleaned up after failure

### Test Case 7: Backward Compatibility Test
**Objective**: Verify existing privateKey parameter still works

**Preconditions**:
- MCP server is running
- Private key content available

**Execution Steps**:
1. Read key content:
   ```bash
   cat ~/ssh-test-keys/valid/test_rsa_unencrypted
   ```
2. Connect using privateKey parameter (legacy approach):
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "legacy_privatekey",
       "host": "localhost",
       "username": "test_user",
       "privateKey": "<paste key content here>"
     }
   }
   ```
3. Verify connection works
4. Execute test command
5. Disconnect

**Success Criteria**:
- Legacy privateKey parameter still functional
- No deprecation warnings (unless intended)
- Same functionality as keyFilePath approach

### Test Case 8: Priority Testing (privateKey vs keyFilePath)
**Objective**: Verify privateKey takes priority over keyFilePath when both provided

**Preconditions**:
- Two different SSH keys authorized for test_user
- MCP server is running

**Execution Steps**:
1. Provide both privateKey and keyFilePath:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "priority_test",
       "host": "localhost",
       "username": "test_user",
       "privateKey": "<content of test_rsa_unencrypted>",
       "keyFilePath": "~/ssh-test-keys/valid/test_ed25519_unencrypted"
     }
   }
   ```
2. Execute command to identify which key was used:
   ```json
   {
     "tool": "ssh_execute",
     "arguments": {
       "sessionName": "priority_test",
       "command": "ssh-add -L 2>/dev/null || echo $SSH_CONNECTION"
     }
   }
   ```
3. Verify privateKey was used (not keyFilePath)

**Success Criteria**:
- privateKey parameter takes precedence
- No warnings about conflicting parameters
- Clear documentation of priority order

### Test Case 9: Tilde Expansion Validation
**Objective**: Verify tilde (~) properly expands to home directory

**Preconditions**:
- Keys exist in home directory structure
- MCP server is running

**Execution Steps**:
1. Test with tilde path:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "tilde_expansion",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted"
     }
   }
   ```
2. Test with absolute path:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "absolute_path",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "/home/<current_user>/ssh-test-keys/valid/test_ed25519_unencrypted"
     }
   }
   ```
3. Both should succeed equally

**Success Criteria**:
- Tilde paths correctly expand
- Absolute paths work directly
- Consistent behavior across path types

### Test Case 10: Concurrent Connections with Different Keys
**Objective**: Verify multiple simultaneous connections using different key files

**Preconditions**:
- Multiple key pairs configured
- MCP server is running

**Execution Steps**:
1. Establish first connection with RSA key:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "session_rsa",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted"
     }
   }
   ```
2. Establish second connection with ED25519 key:
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "session_ed25519",
       "host": "localhost",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_ed25519_unencrypted"
     }
   }
   ```
3. Execute commands on both sessions:
   ```json
   {
     "tool": "ssh_execute",
     "arguments": {
       "sessionName": "session_rsa",
       "command": "echo 'RSA session active' && sleep 2"
     }
   }
   ```
   ```json
   {
     "tool": "ssh_execute",
     "arguments": {
       "sessionName": "session_ed25519",
       "command": "echo 'ED25519 session active' && sleep 2"
     }
   }
   ```
4. List active sessions:
   ```json
   {
     "tool": "ssh_list_sessions"
   }
   ```
5. Verify both sessions appear as connected

**Success Criteria**:
- Multiple sessions work simultaneously
- Each uses its specified key correctly
- No session interference
- Clean session management

**Cleanup**:
Disconnect both sessions

### Test Case 11: Performance and Load Testing
**Objective**: Verify key file reading doesn't impact performance

**Preconditions**:
- Test environment prepared
- MCP server is running

**Execution Steps**:
1. Measure connection time with keyFilePath:
   ```bash
   time curl -X POST http://localhost:3000/rpc \
     -H "Content-Type: application/json" \
     -d '{"method":"ssh_connect","params":{"name":"perf_test","host":"localhost","username":"test_user","keyFilePath":"~/ssh-test-keys/valid/test_rsa_unencrypted"}}'
   ```
2. Record connection establishment time (should be < 2 seconds)
3. Rapidly connect/disconnect 10 times:
   ```bash
   for i in {1..10}; do
     # Connect
     curl -X POST http://localhost:3000/rpc -H "Content-Type: application/json" \
       -d "{\"method\":\"ssh_connect\",\"params\":{\"name\":\"load_test_$i\",\"host\":\"localhost\",\"username\":\"test_user\",\"keyFilePath\":\"~/ssh-test-keys/valid/test_rsa_unencrypted\"}}"
     # Disconnect
     curl -X POST http://localhost:3000/rpc -H "Content-Type: application/json" \
       -d "{\"method\":\"ssh_disconnect\",\"params\":{\"sessionName\":\"load_test_$i\"}}"
   done
   ```
4. Monitor server memory and CPU usage
5. Check for memory leaks or hanging connections

**Success Criteria**:
- Connection time < 2 seconds
- No memory leaks detected
- All connections properly closed
- Server remains responsive

### Test Case 12: Error Recovery and Cleanup
**Objective**: Verify proper cleanup after connection failures

**Preconditions**:
- MCP server is running
- Test environment prepared

**Execution Steps**:
1. Attempt failed connection (wrong host):
   ```json
   {
     "tool": "ssh_connect",
     "arguments": {
       "name": "failed_connection",
       "host": "nonexistent.host.local",
       "username": "test_user",
       "keyFilePath": "~/ssh-test-keys/valid/test_rsa_unencrypted"
     }
   }
   ```
2. Verify timeout error after appropriate wait
3. Check session list doesn't contain failed session:
   ```json
   {
     "tool": "ssh_list_sessions"
   }
   ```
4. Verify no zombie processes:
   ```bash
   ps aux | grep ssh | grep defunct
   ```
5. Check server logs for proper error handling

**Success Criteria**:
- Failed connections don't appear in session list
- No zombie processes created
- Server remains stable after failures
- Clear error messages returned

## Test Execution Tracking

### Pre-Test Checklist
- [ ] SSH server running on localhost
- [ ] test_user account configured with password123
- [ ] Test SSH keys generated
- [ ] Public keys added to authorized_keys
- [ ] MCP server built successfully
- [ ] MCP server started and listening
- [ ] Client tool ready for testing

### Test Results Summary
| Test Case | Status | Execution Time | Notes |
|-----------|--------|----------------|-------|
| TC1: Unencrypted RSA | | | |
| TC2: Encrypted RSA | | | |
| TC3: ED25519 Support | | | |
| TC4: Path Traversal Security | | | |
| TC5: Invalid Key Files | | | |
| TC6: Wrong Passphrase | | | |
| TC7: Backward Compatibility | | | |
| TC8: Priority Testing | | | |
| TC9: Tilde Expansion | | | |
| TC10: Concurrent Connections | | | |
| TC11: Performance Testing | | | |
| TC12: Error Recovery | | | |

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: "Permission denied (publickey)"
**Diagnosis Steps**:
1. Check SSH server logs: `sudo journalctl -u ssh -n 50`
2. Verify public key in authorized_keys: `sudo cat /home/test_user/.ssh/authorized_keys`
3. Check file permissions: `ls -la /home/test_user/.ssh/`
**Solution**: 
- Ensure .ssh directory is 700
- Ensure authorized_keys is 600
- Verify public key matches private key

#### Issue: "Key is encrypted but no passphrase provided"
**Diagnosis Steps**:
1. Check key header: `head -n 1 ~/ssh-test-keys/valid/test_rsa_encrypted`
2. Look for "ENCRYPTED" in key file
**Solution**: 
- Provide passphrase parameter
- Or use unencrypted key

#### Issue: Connection timeout
**Diagnosis Steps**:
1. Test SSH directly: `ssh test_user@localhost`
2. Check firewall: `sudo iptables -L`
3. Verify SSH service: `sudo systemctl status ssh`
**Solution**:
- Ensure SSH service is running
- Check firewall rules
- Verify localhost resolves correctly

#### Issue: "ENOENT: no such file or directory"
**Diagnosis Steps**:
1. Check file exists: `ls -la ~/ssh-test-keys/valid/`
2. Verify path expansion: `echo ~`
**Solution**:
- Use absolute paths if tilde expansion fails
- Verify file exists at specified location

### Log File Locations
- MCP Server logs: Console output where `npm start` is running
- SSH Server logs: `/var/log/auth.log` or `journalctl -u ssh`
- System logs: `/var/log/syslog`

### Debug Commands
```bash
# Check SSH server status
sudo systemctl status ssh

# Monitor authentication attempts
sudo tail -f /var/log/auth.log

# List active SSH connections
ss -tnp | grep :22

# Check test_user SSH configuration
sudo -u test_user ls -la ~/.ssh/

# Verify key fingerprints
ssh-keygen -lf ~/ssh-test-keys/valid/test_rsa_unencrypted.pub
```

## Cleanup Procedures

### After Each Test Case
1. Disconnect active sessions
2. Clear any temporary files
3. Reset test state

### Complete Test Cleanup
```bash
# Remove test SSH keys
rm -rf ~/ssh-test-keys

# Remove authorized_keys entries (keep backup first)
sudo -u test_user cp /home/test_user/.ssh/authorized_keys /home/test_user/.ssh/authorized_keys.backup
sudo -u test_user > /home/test_user/.ssh/authorized_keys

# Stop MCP server (Ctrl+C in terminal)

# Clear any SSH agent keys
ssh-add -D 2>/dev/null || true

# Kill any hanging SSH processes
pkill -f "ssh.*test_user" || true
```

## Success Criteria Summary

The SSH key file authentication enhancement is considered successfully validated when:

1. **Functional Requirements Met**:
   - All supported key types work (RSA, ED25519)
   - Both encrypted and unencrypted keys function correctly
   - Passphrase handling works as specified
   - Tilde expansion operates correctly
   - Error messages are clear and actionable

2. **Security Requirements Met**:
   - Path traversal attempts are blocked
   - No sensitive information leaked in errors
   - Passphrases not logged or exposed
   - File permissions properly validated

3. **Compatibility Requirements Met**:
   - Legacy privateKey parameter still works
   - Priority order (privateKey > keyFilePath > password) is correct
   - No regression in existing functionality

4. **Performance Requirements Met**:
   - Connection establishment < 2 seconds
   - No memory leaks detected
   - Concurrent connections work properly
   - Server remains stable under load

5. **Error Handling Requirements Met**:
   - All error conditions handled gracefully
   - Clear error messages for troubleshooting
   - Proper cleanup after failures
   - No zombie processes or hanging connections

## Test Report Template

```
Test Execution Date: _______________
Tester: _______________
Environment: _______________
MCP Server Version: _______________

Overall Result: PASS / FAIL

Critical Issues Found:
1. 
2. 

Non-Critical Issues Found:
1.
2.

Recommendations:
1.
2.

Sign-off: _______________
```