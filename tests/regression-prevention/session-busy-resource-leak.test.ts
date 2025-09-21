/**
 * SESSION_BUSY Resource Leak Tests
 *
 * Testing the critical resource leak discovered in mcp-ssh-server.ts
 * where successful MCP command execution NEVER calls completeCommandExecution(),
 * leaving sessions permanently locked in EXECUTING_COMMAND state.
 */

import { MCPSSHServer } from '../../src/mcp-ssh-server';
import { SSHConnectionManager } from '../../src/ssh-connection-manager';
import { TerminalSessionStateManager } from '../../src/terminal-session-state-manager';

describe('SESSION_BUSY Resource Leak Prevention', () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  let stateManager: TerminalSessionStateManager;

  const TEST_SESSION_NAME = 'test-resource-leak-session';

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    stateManager = new TerminalSessionStateManager();
    mcpServer = new MCPSSHServer({}, sshManager, stateManager);

    // Create test SSH session
    await sshManager.createConnection({
      name: TEST_SESSION_NAME,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });
  });

  afterEach(async () => {
    // Let sessions clean up naturally - no explicit cleanup method found
  });

  describe('Resource Leak Reproduction Tests', () => {
    test('FAILING TEST: Successful MCP command execution leaves session locked', async () => {
      // This test should FAIL initially due to the resource leak

      // Execute first MCP command - should succeed
      const firstResult = await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "first command"'
      }) as any;

      // Verify first command succeeded
      expect(firstResult.success).toBe(true);
      expect(firstResult.result.stdout).toContain('first command');

      // CRITICAL TEST: Second MCP command should work but will fail due to resource leak
      const secondResult = await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "second command"'
      }) as any;

      // This assertion should now PASS with the resource leak fix
      expect(secondResult.success).toBe(true);
      expect(secondResult.result.stdout).toContain('second command');
      expect(secondResult.error).toBeUndefined();
    });

    test('FAILING TEST: Session state remains EXECUTING_COMMAND after successful execution', async () => {
      // Execute MCP command
      await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'pwd'
      });

      // CRITICAL CHECK: Session should be WAITING_FOR_COMMAND, not EXECUTING_COMMAND
      const sessionState = stateManager.getSessionState(TEST_SESSION_NAME);
      expect(sessionState).toBe('WAITING_FOR_COMMAND');  // This will FAIL - should be EXECUTING_COMMAND
    });

    test('FAILING TEST: Multiple sequential MCP commands should all succeed', async () => {
      const commands = ['pwd', 'whoami', 'date', 'echo "test"'];

      for (let i = 0; i < commands.length; i++) {
        const result = await mcpServer.callTool('ssh_exec', {
          sessionName: TEST_SESSION_NAME,
          command: commands[i]
        }) as any;

        // All commands should succeed, but only first will work due to resource leak
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('Resource Management Consistency Tests', () => {
    test('Error path properly cleans up session state', async () => {
      // Execute command that will fail
      const result = await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'nonexistent-command-that-will-fail'
      }) as any;

      // Error should be handled (command exists but fails)
      expect(result).toBeDefined();

      // Session should be available for next command
      const nextResult = await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "after error"'
      }) as any;

      expect(nextResult.success).toBe(true);
      expect(nextResult.error).toBeUndefined();
    });

    test('Session state consistency across execution paths', async () => {
      // Initial state should be WAITING_FOR_COMMAND
      let sessionState = stateManager.getSessionState(TEST_SESSION_NAME);
      expect(sessionState).toBe('WAITING_FOR_COMMAND');

      // After successful execution, should return to WAITING_FOR_COMMAND
      await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "success test"'
      });

      sessionState = stateManager.getSessionState(TEST_SESSION_NAME);
      expect(sessionState).toBe('WAITING_FOR_COMMAND');
    });
  });

  describe('RAII Pattern Validation', () => {
    test('Resource acquisition and release symmetry', async () => {
      const initialState = stateManager.getSessionState(TEST_SESSION_NAME);
      expect(initialState).toBe('WAITING_FOR_COMMAND');

      // Execute command
      await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "raii test"'
      });

      // State should be restored to initial condition
      const finalState = stateManager.getSessionState(TEST_SESSION_NAME);
      expect(finalState).toBe('WAITING_FOR_COMMAND');
    });

    test('Exception safety - state cleanup on unexpected errors', async () => {
      // Mock SSH manager to throw unexpected error
      const originalExecute = sshManager.executeCommand;
      sshManager.executeCommand = jest.fn().mockRejectedValue(new Error('Unexpected SSH error'));

      try {
        await mcpServer.callTool('ssh_exec', {
          sessionName: TEST_SESSION_NAME,
          command: 'echo "error test"'
        });
      } catch (error) {
        // Expected to throw
      }

      // Restore original method
      sshManager.executeCommand = originalExecute;

      // Session should still be available for next command
      const nextResult = await mcpServer.callTool('ssh_exec', {
        sessionName: TEST_SESSION_NAME,
        command: 'echo "after exception"'
      }) as any;

      expect(nextResult.success).toBe(true);
      expect(nextResult.error).toBeUndefined();
    });
  });
});