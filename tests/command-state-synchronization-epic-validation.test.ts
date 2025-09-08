/**
 * COMMAND STATE SYNCHRONIZATION EPIC - CRITICAL VALIDATION TEST
 * 
 * This test validates that the epic requirements are fully met:
 * 1. Error code is BROWSER_COMMANDS_EXECUTED (not BROWSER_COMMANDS_ACTIVE)
 * 2. Command results are included for informed decision-making
 * 3. Claude Code can see both commands AND their execution results
 */

import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";

describe('Command State Synchronization Epic - Critical Validation', () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  const testSessionName = 'epic-validation-session';

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    mcpServer = new MCPSSHServer({}, sshManager);
    
    // Create real SSH connection using CLAUDE.md compliant approach (no mocks)
    const connectionResult = await mcpServer.callTool("ssh_connect", {
      name: testSessionName,
      host: "localhost",
      username: "jsbattig",
      keyFilePath: "/home/jsbattig/.ssh/id_ed25519"
    });
    
    // Verify connection was successful
    if (!(connectionResult as any).success) {
      throw new Error(`Failed to establish SSH connection: ${(connectionResult as any).error}`);
    }
  });

  afterEach(async () => {
    if (sshManager.hasSession(testSessionName)) {
      await mcpServer.callTool("ssh_disconnect", { sessionName: testSessionName });
    }
  });

  it('should return BROWSER_COMMANDS_EXECUTED error code (not BROWSER_COMMANDS_ACTIVE)', async () => {
    // Arrange: Add browser command to buffer
    sshManager.addBrowserCommand(testSessionName, 'ls -la', 'test-cmd-1', 'user');

    // Act: Try to execute MCP command
    const result = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "pwd"
    });

    // Assert: Error code must be BROWSER_COMMANDS_EXECUTED
    expect(result).toMatchObject({
      success: false,
      error: 'BROWSER_COMMANDS_EXECUTED',  // CRITICAL: Must NOT be BROWSER_COMMANDS_ACTIVE
      message: 'User executed commands directly in browser',
      retryAllowed: true
    });

    // Assert: Must be object array, not string array
    expect((result as any).browserCommands).toBeInstanceOf(Array);
    expect((result as any).browserCommands[0]).toBeInstanceOf(Object);
    expect((result as any).browserCommands[0]).toHaveProperty('command');
    expect((result as any).browserCommands[0]).toHaveProperty('result');
  });

  it('should include command execution results for informed decision-making', async () => {
    // Arrange: Add browser command and simulate execution result
    sshManager.addBrowserCommand(testSessionName, 'pwd', 'executed-cmd-1', 'user');
    
    // Simulate command execution with actual result
    sshManager.updateBrowserCommandResult(testSessionName, 'executed-cmd-1', {
      stdout: '/home/user/project',
      stderr: '',
      exitCode: 0
    });

    // Act: Try to execute MCP command
    const result = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "ls"
    });

    // Assert: Must include complete command execution results
    expect(result).toEqual({
      success: false,
      error: 'BROWSER_COMMANDS_EXECUTED',
      message: 'User executed commands directly in browser',
      browserCommands: [
        {
          command: 'pwd',
          commandId: 'executed-cmd-1',
          timestamp: expect.any(Number),
          source: 'user',
          result: {
            stdout: '/home/user/project',  // CRITICAL: Must include actual command output
            stderr: '',
            exitCode: 0  // CRITICAL: Must include actual exit code
          }
        }
      ],
      retryAllowed: true
    });
  });

  it('should provide both successful and failed command results for complete context', async () => {
    // Arrange: Add multiple commands with different results
    sshManager.addBrowserCommand(testSessionName, 'pwd', 'success-cmd', 'user');
    sshManager.addBrowserCommand(testSessionName, 'invalid-command', 'failed-cmd', 'user');
    
    // Simulate successful command result
    sshManager.updateBrowserCommandResult(testSessionName, 'success-cmd', {
      stdout: '/home/user',
      stderr: '',
      exitCode: 0
    });
    
    // Simulate failed command result
    sshManager.updateBrowserCommandResult(testSessionName, 'failed-cmd', {
      stdout: '',
      stderr: 'command not found: invalid-command',
      exitCode: 127
    });

    // Act: Try to execute MCP command
    const result = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "echo test"
    });

    // Assert: Must include both success and failure results for informed decisions
    expect((result as any).browserCommands).toHaveLength(2);
    
    // Successful command result
    expect((result as any).browserCommands[0]).toEqual({
      command: 'pwd',
      commandId: 'success-cmd',
      timestamp: expect.any(Number),
      source: 'user',
      result: {
        stdout: '/home/user',
        stderr: '',
        exitCode: 0  // Success
      }
    });
    
    // Failed command result
    expect((result as any).browserCommands[1]).toEqual({
      command: 'invalid-command',
      commandId: 'failed-cmd',
      timestamp: expect.any(Number),
      source: 'user',
      result: {
        stdout: '',
        stderr: 'command not found: invalid-command',
        exitCode: 127  // Failure
      }
    });
  });

  it('should show default result values for commands not yet executed', async () => {
    // Arrange: Add command to buffer but don't execute it
    sshManager.addBrowserCommand(testSessionName, 'pending-command', 'not-executed', 'user');

    // Act: Try to execute MCP command immediately
    const result = await mcpServer.callTool("ssh_exec", {
      sessionName: testSessionName,
      command: "test"
    });

    // Assert: Not-yet-executed commands show default result values
    expect((result as any).browserCommands[0]).toEqual({
      command: 'pending-command',
      commandId: 'not-executed',
      timestamp: expect.any(Number),
      source: 'user',
      result: {
        stdout: '',
        stderr: '',
        exitCode: -1  // -1 indicates command not yet executed
      }
    });
  });
});