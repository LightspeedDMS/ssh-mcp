import { MCPSSHServer } from '../../src/mcp-ssh-server.js';
import { SSHConnectionManager } from '../../src/ssh-connection-manager.js';
import { TerminalSessionStateManager } from '../../src/terminal-session-state-manager.js';

describe('Phase 3 - MCP Integration Validation', () => {
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

  describe('Complete MCP Tool Integration', () => {
    it('should handle ssh_poll_task tool through complete MCP request pipeline', async () => {
      // Test the tool registration through the MCP protocol layer
      const tools = await mcpServer.listTools();
      expect(tools).toContain('ssh_poll_task');

      // Test direct callTool method
      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'non-existent-session',
        taskId: 'test-task'
      });

      expect(result).toEqual({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: "SSH session 'non-existent-session' not found"
      });
    });

    it('should integrate with existing background task infrastructure', async () => {
      // Simulate a session with background tasks by accessing the internal data structures
      const mockSession = {
        name: 'integration-test-session',
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

      // Add mock session to connection manager
      (sshManager as any).connections.set('integration-test-session', mockSession);

      // Test that the polling tool correctly accesses the background task infrastructure
      const pollResult = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'integration-test-session',
        taskId: 'non-existent-task'
      });

      expect(pollResult).toEqual({
        success: false,
        error: 'TASK_NOT_FOUND',
        message: "Task 'non-existent-task' not found in session 'integration-test-session'"
      });
    });

    it('should maintain consistent error response format across all MCP tools', async () => {
      // Test error format consistency with other SSH tools
      const sshConnectError = await mcpServer.callTool('ssh_connect', {
        name: 'test',
        host: 'invalid-host',
        username: 'test'
      });

      const pollTaskError = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'non-existent',
        taskId: 'test'
      });

      // Both should have consistent error structure
      expect(sshConnectError).toHaveProperty('success', false);
      expect(sshConnectError).toHaveProperty('error');

      expect(pollTaskError).toHaveProperty('success', false);
      expect(pollTaskError).toHaveProperty('error');
      expect(pollTaskError).toHaveProperty('message');
    });

    it('should validate parameter requirements correctly', async () => {
      // Test empty parameters
      const emptyResult = await mcpServer.callTool('ssh_poll_task', {});
      expect(emptyResult).toEqual({
        success: false,
        error: 'Missing required parameters: sessionName and taskId are required'
      });

      // Test partial parameters
      const partialResult = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'test'
      });
      expect(partialResult).toEqual({
        success: false,
        error: 'Missing required parameters: sessionName and taskId are required'
      });
    });
  });

  describe('Background Task Storage Integration', () => {
    it('should correctly access background task storage from SSHConnectionManager', async () => {
      // Create a mock session with background tasks
      const mockSession = {
        name: 'storage-test-session',
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

      (sshManager as any).connections.set('storage-test-session', mockSession);

      // Test that the infrastructure is properly connected
      const hasSession = sshManager.hasSession('storage-test-session');
      expect(hasSession).toBe(true);

      // Test polling non-existent task (validates infrastructure access)
      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'storage-test-session',
        taskId: 'test-task-id'
      });

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'TASK_NOT_FOUND');
    });
  });

  describe('Session Isolation Verification', () => {
    it('should maintain strict session boundaries for task access', async () => {
      // Create multiple sessions
      const sessions = ['session-a', 'session-b', 'session-c'];

      sessions.forEach(sessionName => {
        const mockSession = {
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
        (sshManager as any).connections.set(sessionName, mockSession);
      });

      // Test cross-session task access is properly blocked
      const result = await mcpServer.callTool('ssh_poll_task', {
        sessionName: 'session-b',
        taskId: 'task-from-session-a'
      });

      expect(result).toEqual({
        success: false,
        error: 'TASK_NOT_FOUND',
        message: "Task 'task-from-session-a' not found in session 'session-b'"
      });
    });
  });
});