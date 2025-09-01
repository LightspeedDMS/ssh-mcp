# Epic 6: End-to-End Testing Infrastructure

## Epic Intent
Implement comprehensive end-to-end testing infrastructure that validates the complete SSH MCP server functionality using real SSH connections to localhost, ensuring all components work together without any mocking or simulation.

## Story 1: Test Environment Setup
As a developer running E2E tests, I want automated test environment setup so that tests can run reliably with real SSH connections.

### Acceptance Criteria
- **Given** E2E tests need to run against real SSH connections
- **When** the test environment is initialized
- **Then** localhost SSH connection is verified using test_user/password123
- **And** test user home directory is accessible and writable
- **And** test directory structure is created for file operations
- **And** SSH host key is properly configured for localhost
- **And** StrictHostKeyChecking is disabled for test connections
- **And** test environment cleanup removes all temporary files
- **And** environment setup validates all prerequisites before tests begin

**Environment Requirements:**
- SSH server running on localhost
- test_user account with password123
- Writable test directory: /home/test_user/ssh-mcp-test/
- Clean state before each test run

## Story 2: MCP Server Lifecycle Testing
As a developer validating the MCP server, I want E2E tests that verify server startup, operation, and shutdown so that I can ensure the complete server lifecycle works correctly.

### Acceptance Criteria
- **Given** the MCP server implementation exists
- **When** E2E lifecycle tests are executed
- **Then** MCP server starts successfully and binds to configured ports
- **And** server responds to MCP handshake within 5 seconds
- **And** web monitoring server is accessible on expected port
- **And** server handles multiple client connections simultaneously
- **And** server shuts down gracefully when terminated
- **And** all SSH connections are closed during shutdown
- **And** server resources are fully cleaned up after shutdown

**Test Sequence:**
1. Start MCP server
2. Verify MCP protocol handshake
3. Verify web server accessibility
4. Create test SSH connections
5. Shutdown server
6. Verify complete cleanup

## Story 3: SSH Connection Management E2E Tests
As a developer validating SSH functionality, I want comprehensive E2E tests for SSH connection management so that I can verify connections work end-to-end with real SSH servers.

### Acceptance Criteria
- **Given** the MCP server is running and test SSH server is available
- **When** SSH connection E2E tests are executed
- **Then** ssh_connect tool establishes real connection to localhost
- **And** connection uses password authentication with test_user/password123
- **And** connection status is properly tracked and reported
- **And** multiple named connections can be created simultaneously
- **And** connection health monitoring detects real connection failures
- **And** automatic reconnection works when connection is interrupted
- **And** connections are properly isolated from each other

**Test Cases:**
- Successful connection establishment
- Authentication failure handling
- Multiple concurrent connections
- Connection interruption and recovery
- Connection timeout handling
- Duplicate connection name rejection

## Story 4: Command Execution E2E Tests
As a developer validating command execution, I want E2E tests that execute real commands on remote systems so that I can verify command execution works without any mocking.

### Acceptance Criteria
- **Given** active SSH connections exist to localhost
- **When** command execution E2E tests run
- **Then** bash commands execute successfully on the remote system
- **And** command output (stdout/stderr) is captured completely
- **And** command exit codes are returned accurately
- **And** working directory changes persist between commands
- **And** environment variables persist between commands
- **And** long-running commands complete without timeout issues
- **And** commands with large output are handled correctly

**Test Commands:**
```bash
# Basic command execution
echo "Hello from remote system"

# Working directory persistence  
cd /tmp && pwd && mkdir ssh-mcp-test && cd ssh-mcp-test && pwd

# Environment variable persistence
export TEST_VAR="test_value" && echo $TEST_VAR

# Large output handling
find /usr -name "*.so" | head -1000

# Long-running command
sleep 5 && echo "Long command completed"
```

## Story 5: Real-Time Monitoring E2E Tests
As a developer validating the monitoring interface, I want E2E tests that verify real-time terminal monitoring through browser connections so that monitoring works end-to-end.

### Acceptance Criteria
- **Given** SSH sessions are active and web server is running
- **When** monitoring E2E tests execute
- **Then** session monitoring URLs are generated and accessible
- **And** WebSocket connections establish successfully to monitoring endpoints
- **And** real command output appears in browser terminal in real-time
- **And** terminal colors and formatting are preserved
- **And** command history is displayed correctly
- **And** multiple browser connections can monitor the same session
- **And** connection status indicators update accurately
- **And** WebSocket reconnection works after interruption

**Monitoring Test Sequence:**
1. Create SSH session and execute commands
2. Open monitoring URL and establish WebSocket
3. Verify historical output display
4. Execute new commands and verify real-time updates
5. Interrupt WebSocket and verify reconnection
6. Test multiple concurrent monitoring connections

## Story 6: File Transfer E2E Tests
As a developer validating file operations, I want E2E tests for file transfers that use real SFTP operations so that file transfer functionality is proven to work end-to-end.

### Acceptance Criteria
- **Given** SSH sessions exist with SFTP capability
- **When** file transfer E2E tests execute
- **Then** individual files upload successfully to remote system
- **And** uploaded files have correct content and permissions
- **And** individual files download successfully from remote system
- **And** directory uploads transfer complete directory structures
- **And** directory downloads retrieve complete directory structures
- **And** file permissions and timestamps are preserved
- **And** large file transfers complete without corruption
- **And** transfer progress is reported accurately

**File Transfer Test Cases:**
- Upload small text file (< 1KB)
- Upload large binary file (> 1MB)
- Download system file (/etc/hostname)
- Upload directory with subdirectories
- Download directory with mixed file types
- Verify file integrity with checksums
- Test transfer interruption and recovery

## Story 7: Security and Error Handling E2E Tests
As a developer validating security, I want E2E tests that verify security measures and error handling work with real security scenarios so that security is proven effective.

### Acceptance Criteria
- **Given** various security scenarios need testing
- **When** security E2E tests execute
- **Then** invalid credentials are rejected with specific error messages
- **And** host key verification prevents connection to untrusted hosts
- **And** session isolation prevents cross-session data access
- **And** resource limits are enforced during actual operations
- **And** connection timeouts work with real network delays
- **And** audit logs capture real security events accurately
- **And** credential information never appears in logs or responses

**Security Test Scenarios:**
- Wrong password authentication failure
- Invalid SSH key authentication failure
- Host key mismatch detection
- Session isolation verification
- Resource limit enforcement
- Connection timeout validation
- Audit log verification

## Story 8: Full Integration Workflow E2E Test
As a developer validating the complete system, I want a comprehensive workflow test that simulates the distributed development lifecycle so that the entire intended use case is proven to work.

### Acceptance Criteria
- **Given** the complete SSH MCP server system is running
- **When** the full integration workflow test executes
- **Then** the following complete workflow succeeds without any failures:
  1. **Connection Setup**: Create named SSH connection to development server
  2. **Code Synchronization**: Upload local project files to remote system
  3. **Remote Build**: Execute build commands and capture output
  4. **Testing**: Run remote tests and capture results
  5. **Log Retrieval**: Download build logs and test results
  6. **Monitoring**: Verify all operations are visible in real-time monitoring
  7. **Cleanup**: Disconnect sessions and clean up resources

**End-to-End Workflow Test:**
```pseudocode
# Step 1: Connection
ssh_connect("dev-server", "localhost", {user: "test_user", password: "password123"})
verify connection_status == "connected"
verify monitoring_url is accessible

# Step 2: File Upload  
create local test project with multiple files
ssh_upload("dev-server", "./test-project/", "/home/test_user/remote-project/")
verify all files transferred correctly

# Step 3: Remote Operations
ssh_exec("dev-server", "cd /home/test_user/remote-project && ls -la")
ssh_exec("dev-server", "echo 'Building project...' && sleep 2 && echo 'Build complete'")
verify command outputs captured correctly

# Step 4: File Download
ssh_download("dev-server", "/home/test_user/remote-project/output.log", "./retrieved-log.txt")
verify downloaded file content matches

# Step 5: Monitoring Verification
verify all commands visible in monitoring interface
verify real-time updates worked correctly

# Step 6: Cleanup
ssh_disconnect("dev-server")
verify connection closed cleanly
verify no resource leaks
```

**Integration Test Success Criteria:**
- Complete workflow completes in under 60 seconds
- No errors or failures in any step
- All file transfers maintain data integrity
- Real-time monitoring captures all operations
- Resource cleanup is complete