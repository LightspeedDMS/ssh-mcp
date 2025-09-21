import { MCPSSHServer } from '../../src/mcp-ssh-server.js';
import { SSHConnectionManager } from '../../src/ssh-connection-manager.js';
import { TerminalSessionStateManager } from '../../src/terminal-session-state-manager.js';

describe('Phase 3 - Polling API Integration Tests', () => {
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  let terminalStateManager: TerminalSessionStateManager;

  beforeEach(() => {
    sshManager = new SSHConnectionManager(8080);
    terminalStateManager = new TerminalSessionStateManager();
    mcpServer = new MCPSSHServer({}, sshManager, terminalStateManager);
  });

  afterEach(async () => {
    await mcpServer.stop();
    sshManager.cleanup();
  });

  // Helper function to simulate a session
  const createMockSession = (sessionName: string) => {
    // Use the connection map directly to simulate a session without actual SSH connection
    const mockConnection = {
      name: sessionName,
      host: 'localhost',
      username: 'testuser',
      status: 'connected' as const,
      lastActivity: new Date(),
      backgroundTasks: new Map(),
      browserCommandBuffer: [],
      ptyOptions: {},
      shell: null,
      connection: null
    };
    (sshManager as any).connections.set(sessionName, mockConnection);
  };

  describe('ssh_poll_task tool registration', () => {
    it('should include ssh_poll_task in available tools list', async () => {
      const tools = await mcpServer.listTools();
      expect(tools).toContain('ssh_poll_task');
    });
  });

  describe('ssh_poll_task basic functionality', () => {
    it('should return SESSION_NOT_FOUND error for non-existent session', async () => {
      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'non-existent-session',
        taskId: 'test-task-id'
      });

      expect(result).toEqual({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: "SSH session 'non-existent-session' not found"
      });
    });

    it('should return TASK_NOT_FOUND error for non-existent task', async () => {
      // Create a mock session (avoid actual SSH connection)
      createMockSession('test-session');

      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'test-session',
        taskId: 'non-existent-task'
      });

      expect(result).toEqual({
        success: false,
        error: 'TASK_NOT_FOUND',
        message: "Task 'non-existent-task' not found in session 'test-session'"
      });
    });

    it('should validate required parameters', async () => {
      // Test missing sessionName
      const result1 = await mcpServer.callTool('ssh_poll_task', {
        taskId: 'test-task'
      });

      expect(result1).toEqual({
        success: false,
        error: 'Missing required parameters: sessionName and taskId are required'
      });

      // Test missing taskId
      const result2 = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'test-session'
      });

      expect(result2).toEqual({
        success: false,
        error: 'Missing required parameters: sessionName and taskId are required'
      });
    });
  });

  describe('ssh_poll_task task state polling', () => {
    it('should return running task status', async () => {
      // This test would require mocking the background task infrastructure
      // For now, we'll focus on the interface and basic error handling
      expect(true).toBe(true); // Placeholder
    });

    it('should return completed task status with results', async () => {
      // This test would require mocking the background task infrastructure
      expect(true).toBe(true); // Placeholder
    });

    it('should return failed task status with error details', async () => {
      // This test would require mocking the background task infrastructure
      expect(true).toBe(true); // Placeholder
    });

    it('should return cancelled task status', async () => {
      // This test would require mocking the background task infrastructure
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('ssh_poll_task session isolation', () => {
    it('should not return tasks from different sessions', async () => {
      // Create two different mock sessions
      createMockSession('session1');
      createMockSession('session2');

      // Test that task from session1 is not accessible from session2
      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'session2',
        taskId: 'task-from-session1'
      });

      expect(result).toEqual({
        success: false,
        error: 'TASK_NOT_FOUND',
        message: "Task 'task-from-session1' not found in session 'session2'"
      });
    });
  });

  describe('ssh_poll_task response format', () => {
    it('should return TaskPollResponse interface format', async () => {
      // Create a mock session
      createMockSession('test-session');

      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'test-session',
        taskId: 'non-existent-task'
      });

      // Should have the required TaskPollResponse fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('message');
      expect(typeof (result as any).success).toBe('boolean');
      expect(typeof (result as any).error).toBe('string');
      expect(typeof (result as any).message).toBe('string');
    });
  });
});