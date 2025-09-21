import { MCPSSHServer } from '../../src/mcp-ssh-server.js';
import { SSHConnectionManager } from '../../src/ssh-connection-manager.js';
import { TaskState, BackgroundTask } from '../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Phase 2: Threaded Task Execution Integration Tests
 *
 * Tests the implementation of background task execution with:
 * - Optional asyncTimeout parameter
 * - Background task continuation after MCP timeout
 * - Session-based task storage and retrieval
 * - Unified code path for browser and MCP commands
 * - Async mode transition with error responses and polling instructions
 */

describe('Phase 2: Threaded Task Execution', () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  let testSessionName: string;
  let privateKeyPath: string;

  beforeAll(async () => {
    // Setup test environment
    testSessionName = 'test-threaded-exec-session';
    privateKeyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');

    // Verify SSH key exists
    try {
      await fs.access(privateKeyPath);
    } catch (error) {
      throw new Error(`SSH private key not found at ${privateKeyPath}. Please ensure SSH keys are set up for localhost testing.`);
    }

    // Initialize components
    sshManager = new SSHConnectionManager(8080);
    mcpServer = new MCPSSHServer({}, sshManager);
  });

  beforeEach(async () => {
    // Clean up any existing test session
    if (sshManager.hasSession(testSessionName)) {
      await sshManager.disconnectSession(testSessionName);
    }

    // Clear terminal state manager for clean test start
    const terminalStateManager = mcpServer.getTerminalStateManager();
    if (!terminalStateManager.canAcceptCommand(testSessionName)) {
      // Force cleanup any remaining state
      try {
        terminalStateManager.completeCommandExecution(testSessionName, 'cleanup');
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Create fresh SSH connection for each test
    await sshManager.createConnection({
      name: testSessionName,
      host: 'localhost',
      username: process.env.USER || 'testuser',
      keyFilePath: privateKeyPath,
    });
  });

  afterEach(async () => {
    // Clean up test session
    if (sshManager.hasSession(testSessionName)) {
      await sshManager.disconnectSession(testSessionName);
    }
  });

  afterAll(async () => {
    // Final cleanup
    sshManager.cleanup();
  });

  describe('AsyncTimeout Parameter Handling', () => {
    it('should accept asyncTimeout parameter in ssh_exec command', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'echo "testing asyncTimeout parameter"',
        asyncTimeout: 5000
      };

      // This test should fail initially because asyncTimeout is not yet implemented
      const result = await mcpServer.callTool('ssh_exec', execArgs);

      // The result should acknowledge the asyncTimeout parameter without error
      expect(result).toHaveProperty('success', true);
    });

    it('should validate asyncTimeout parameter is a positive number', async () => {
      const execArgsNegative = {
        sessionName: testSessionName,
        command: 'echo "test"',
        asyncTimeout: -1000
      };

      // This should fail with validation error
      const resultNegative = await mcpServer.callTool('ssh_exec', execArgsNegative);
      expect(resultNegative).toHaveProperty('success', false);
      expect(resultNegative).toHaveProperty('error');
    });

    it('should reject zero asyncTimeout', async () => {
      const execArgsZero = {
        sessionName: testSessionName,
        command: 'echo "test"',
        asyncTimeout: 0
      };

      const resultZero = await mcpServer.callTool('ssh_exec', execArgsZero);
      expect(resultZero).toHaveProperty('success', false);
      expect(resultZero).toHaveProperty('error');
    });

    it('should accept undefined asyncTimeout (infinite wait)', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'echo "testing default behavior"'
        // asyncTimeout intentionally undefined
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs);
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('Background Task Execution', () => {
    it('should execute commands in background threads', async () => {
      const longRunningCommand = 'sleep 5 && echo "background task completed"';
      const execArgs = {
        sessionName: testSessionName,
        command: longRunningCommand,
        asyncTimeout: 500 // 0.5 second timeout to guarantee timeout occurs
      };

      // Execute command with short asyncTimeout
      const startTime = Date.now();
      const result = await mcpServer.callTool('ssh_exec', execArgs);
      const executionTime = Date.now() - startTime;

      // Should return error response quickly due to asyncTimeout
      expect(executionTime).toBeLessThan(2000); // Should timeout around 1 second
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'ASYNC_TIMEOUT');

      // Should include polling instructions
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('taskId');

      // Task should continue running in background
      // This test will initially fail because background execution is not implemented
    });

    it('should store task references in session for future polling', async () => {
      const command = 'sleep 2 && echo "session task storage test"';
      const execArgs = {
        sessionName: testSessionName,
        command: command,
        asyncTimeout: 500
      };

      // Execute command that will timeout
      const result = await mcpServer.callTool('ssh_exec', execArgs) as any;
      expect(result.success).toBe(false);
      expect(result.error).toBe('ASYNC_TIMEOUT');
      expect(result.taskId).toBeDefined();

      // Should be able to check task status via session
      // This functionality doesn't exist yet, so this test will fail
      const taskStatus = await sshManager.getBackgroundTaskStatus(testSessionName, result.taskId);
      expect(taskStatus).toBeDefined();
      expect(taskStatus.state).toBe(TaskState.RUNNING);
    });

    it('should maintain task isolation between sessions', async () => {
      const secondSessionName = 'test-session-2';

      // Create second session
      await sshManager.createConnection({
        name: secondSessionName,
        host: 'localhost',
        username: process.env.USER || 'testuser',
        keyFilePath: privateKeyPath,
      });

      try {
        // Start tasks in both sessions
        const task1Args = {
          sessionName: testSessionName,
          command: 'sleep 2 && echo "task1"',
          asyncTimeout: 500
        };

        const task2Args = {
          sessionName: secondSessionName,
          command: 'sleep 2 && echo "task2"',
          asyncTimeout: 500
        };

        const result1 = await mcpServer.callTool('ssh_exec', task1Args) as any;
        const result2 = await mcpServer.callTool('ssh_exec', task2Args) as any;

        expect(result1.taskId).toBeDefined();
        expect(result2.taskId).toBeDefined();
        expect(result1.taskId).not.toBe(result2.taskId);

        // Tasks should be isolated to their respective sessions
        const session1Tasks = await sshManager.getSessionBackgroundTasks(testSessionName);
        const session2Tasks = await sshManager.getSessionBackgroundTasks(secondSessionName);

        expect(session1Tasks).toHaveLength(1);
        expect(session2Tasks).toHaveLength(1);
        expect(session1Tasks[0].taskId).toBe(result1.taskId);
        expect(session2Tasks[0].taskId).toBe(result2.taskId);

      } finally {
        await sshManager.disconnectSession(secondSessionName);
      }
    });
  });

  describe('Async Mode Transition', () => {
    it('should return error response with polling instructions on timeout', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'sleep 5 && echo "long running task"',
        asyncTimeout: 1000
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs) as any;

      // Should return standardized async timeout error
      expect(result.success).toBe(false);
      expect(result.error).toBe('ASYNC_TIMEOUT');
      expect(result.message).toContain('polling');
      expect(result.taskId).toBeDefined();
      expect(result.pollingInstructions).toBeDefined();

      // Should include polling endpoint information
      expect(result.pollingInstructions).toContain('ssh_poll_task');
    });

    it('should include task ID for future polling', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'sleep 3 && echo "polling test"',
        asyncTimeout: 500
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs) as any;
      expect(result.taskId).toMatch(/^task-\d+-[a-z0-9]+$/); // Expected format
    });

    it('should provide clear error message explaining async mode transition', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'sleep 4 && echo "explanation test"',
        asyncTimeout: 750
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs) as any;
      expect(result.message).toContain('Command execution has transitioned to async mode');
      expect(result.message).toContain('Use ssh_poll_task to check status');
    });
  });

  describe('Unified Code Path', () => {
    it('should use identical execution logic for browser and MCP commands', async () => {
      // Test that both browser and MCP commands go through same execution path
      const command = 'echo "unified path test"';

      // Execute via MCP
      const mcpResult = await sshManager.executeCommand(testSessionName, command, {
        source: 'claude',
        asyncTimeout: 2000
      });

      // Execute via browser simulation
      const browserResult = await sshManager.executeCommand(testSessionName, command, {
        source: 'user'
        // No asyncTimeout for browser commands (infinite wait)
      });

      // Both should succeed and use same underlying execution logic
      expect(mcpResult.exitCode).toBe(0);
      expect(browserResult.exitCode).toBe(0);
      expect(mcpResult.stdout.trim()).toBe(browserResult.stdout.trim());
    });

    it('should enforce no timeout mechanism for browser commands', async () => {
      // Browser commands should not use asyncTimeout even if specified
      const longCommand = 'sleep 2 && echo "browser infinite wait"';

      const startTime = Date.now();
      const result = await sshManager.executeCommand(testSessionName, longCommand, {
        source: 'user',
        asyncTimeout: 500 // This should be ignored for browser commands
      });
      const executionTime = Date.now() - startTime;

      // Should complete successfully (not timeout)
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('browser infinite wait');
      expect(executionTime).toBeGreaterThan(1500); // Should take full time
    });

    it('should maintain single active task per session with FIFO queue', async () => {
      // Queue multiple commands to verify FIFO behavior
      const commands = [
        'echo "first command"',
        'echo "second command"',
        'echo "third command"'
      ];

      const promises = commands.map((cmd) =>
        sshManager.executeCommand(testSessionName, cmd, {
          source: 'claude',
          asyncTimeout: 5000
        })
      );

      const results = await Promise.all(promises);

      // All should succeed in order
      expect(results[0].stdout.trim()).toBe('first command');
      expect(results[1].stdout.trim()).toBe('second command');
      expect(results[2].stdout.trim()).toBe('third command');
    });
  });

  describe('Session-Based Task Storage', () => {
    it('should persist task state in session data', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'sleep 3 && echo "storage test"',
        asyncTimeout: 1000
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs) as any;
      const taskId = result.taskId;

      // Task should be stored in session
      const storedTask = await sshManager.getBackgroundTask(testSessionName, taskId);
      expect(storedTask).toBeDefined();
      expect(storedTask.command).toBe('sleep 3 && echo "storage test"');
      expect(storedTask.state).toBe(TaskState.RUNNING);
      expect(storedTask.source).toBe('claude');
    });

    it('should update task state correctly during execution lifecycle', async () => {
      const execArgs = {
        sessionName: testSessionName,
        command: 'echo "lifecycle test"', // Quick command
        asyncTimeout: 5000 // Long timeout, should complete normally
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs) as any;

      // Should complete successfully without transitioning to async mode
      expect(result.success).toBe(true);

      // If a task was created, it should be marked as completed
      if (result.taskId) {
        const task = await sshManager.getBackgroundTask(testSessionName, result.taskId);
        expect(task.state).toBe(TaskState.COMPLETED);
        expect(task.result).toBeDefined();
        expect(task.endTime).toBeDefined();
      }
    });

    it('should clean up completed tasks appropriately', async () => {
      // Implementation detail: define cleanup policy for completed tasks
      // This test will evolve based on cleanup implementation
      const execArgs = {
        sessionName: testSessionName,
        command: 'echo "cleanup test"',
        asyncTimeout: 5000
      };

      const result = await mcpServer.callTool('ssh_exec', execArgs);
      expect(result).toHaveProperty('success', true);

      // After sufficient time, task should be cleaned up or archived
      // Test cleanup policy implementation
    });
  });
});

// Extension methods for SSHConnectionManager (these will need to be implemented)
declare module '../../src/ssh-connection-manager.js' {
  interface SSHConnectionManager {
    getBackgroundTaskStatus(sessionName: string, taskId: string): Promise<BackgroundTask>;
    getSessionBackgroundTasks(sessionName: string): Promise<BackgroundTask[]>;
    getBackgroundTask(sessionName: string, taskId: string): Promise<BackgroundTask>;
  }
}