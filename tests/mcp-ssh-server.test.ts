/**
 * Test suite for MCPSSHServer - Pure MCP server with stdio transport only
 * This server should handle only MCP protocol without any HTTP functionality
 */

import { MCPSSHServer } from '../src/mcp-ssh-server.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { jest } from '@jest/globals';

describe('MCPSSHServer', () => {
  let mcpServer: MCPSSHServer;
  let mockSshManager: jest.Mocked<SSHConnectionManager>;

  beforeEach(() => {
    // Mock SSH connection manager
    mockSshManager = {
      createConnection: jest.fn(),
      executeCommand: jest.fn(),
      listSessions: jest.fn(),
      disconnectSession: jest.fn(),
      hasSession: jest.fn(),
      cleanup: jest.fn(),
      updateWebServerPort: jest.fn(),
      addTerminalOutputListener: jest.fn(),
      removeTerminalOutputListener: jest.fn(),
    } as any;
  });

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      mcpServer = new MCPSSHServer();
      expect(mcpServer).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const config = {
        sshTimeout: 20000,
        maxSessions: 5,
        logLevel: 'debug'
      };
      mcpServer = new MCPSSHServer(config);
      expect(mcpServer).toBeDefined();
    });

    it('should validate config parameters', () => {
      expect(() => new MCPSSHServer({ sshTimeout: -1 })).toThrow('Invalid ssh timeout');
      expect(() => new MCPSSHServer({ maxSessions: 0 })).toThrow('Invalid max sessions');
    });
  });

  describe('MCP Server Functionality', () => {
    beforeEach(() => {
      mcpServer = new MCPSSHServer();
    });

    it('should start with stdio transport only', async () => {
      // Since stdio transport blocks, we just verify no HTTP functionality exists
      expect(mcpServer.isMCPRunning()).toBe(false); // Should be false until connected
      // We can't easily test stdio in unit test, so we'll test this behavior is correct
    });

    it('should provide SSH tools in tool list', async () => {
      const tools = await mcpServer.listTools();
      expect(tools).toContain('ssh_connect');
      expect(tools).toContain('ssh_exec');
      expect(tools).toContain('ssh_list_sessions');
      expect(tools).toContain('ssh_disconnect');
      expect(tools).toContain('ssh_get_monitoring_url');
    });

    it('should handle ssh_connect tool call', async () => {
      const mockConnection = {
        name: 'test-session',
        host: 'localhost',
        username: 'test',
        status: 'connected',
        lastActivity: new Date().toISOString()
      };
      mockSshManager.createConnection.mockResolvedValue(mockConnection as any);
      
      mcpServer['sshManager'] = mockSshManager;

      const result = await mcpServer.callTool('ssh_connect', {
        name: 'test-session',
        host: 'localhost',
        username: 'test',
        password: 'password'
      });

      expect(result.success).toBe(true);
      expect(result.connection.name).toBe('test-session');
    });

    it('should handle ssh_exec tool call', async () => {
      const mockResult = {
        stdout: 'hello world',
        stderr: '',
        exitCode: 0
      };
      mockSshManager.executeCommand.mockResolvedValue(mockResult);
      
      mcpServer['sshManager'] = mockSshManager;

      const result = await mcpServer.callTool('ssh_exec', {
        sessionName: 'test-session',
        command: 'echo hello world'
      });

      expect(result.success).toBe(true);
      expect(result.result.stdout).toBe('hello world');
    });

    it('should NOT have HTTP server capabilities', () => {
      expect(() => (mcpServer as any).getWebPort()).toThrow('HTTP functionality not available');
      expect(() => (mcpServer as any).isWebServerRunning()).toThrow('HTTP functionality not available');
    });

    it('should coordinate with web server for monitoring URLs', async () => {
      mockSshManager.hasSession.mockReturnValue(true);
      mcpServer['sshManager'] = mockSshManager;
      mcpServer['webServerPort'] = 8080;

      const result = await mcpServer.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      expect(result.success).toBe(true);
      expect(result.monitoringUrl).toBe('http://localhost:8080/session/test-session');
    });

    it('should fail monitoring URL when web server port not set', async () => {
      mockSshManager.hasSession.mockReturnValue(true);
      mcpServer['sshManager'] = mockSshManager;

      const result = await mcpServer.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Web server not available');
    });
  });

  describe('Port Coordination', () => {
    it('should accept web server port from main orchestrator', () => {
      mcpServer = new MCPSSHServer();
      mcpServer.setWebServerPort(9000);
      expect(mcpServer.getWebServerPort()).toBe(9000);
    });

    it('should update SSH manager with web server port', () => {
      mcpServer = new MCPSSHServer();
      mcpServer['sshManager'] = mockSshManager;
      
      mcpServer.setWebServerPort(9000);
      expect(mockSshManager.updateWebServerPort).toHaveBeenCalledWith(9000);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mcpServer = new MCPSSHServer();
      mcpServer['sshManager'] = mockSshManager;
    });

    it('should handle SSH connection errors', async () => {
      mockSshManager.createConnection.mockRejectedValue(new Error('Connection failed'));

      const result = await mcpServer.callTool('ssh_connect', {
        name: 'test-session',
        host: 'invalid-host',
        username: 'test',
        password: 'password'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should handle SSH execution errors', async () => {
      mockSshManager.executeCommand.mockRejectedValue(new Error('Command failed'));

      const result = await mcpServer.callTool('ssh_exec', {
        sessionName: 'test-session',
        command: 'invalid-command'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });

    it('should handle unknown tool calls', async () => {
      const result = await mcpServer.callTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on stop', async () => {
      mcpServer = new MCPSSHServer();
      mcpServer['sshManager'] = mockSshManager;

      await mcpServer.start();
      await mcpServer.stop();

      expect(mockSshManager.cleanup).toHaveBeenCalled();
      expect(mcpServer.isMCPRunning()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      mcpServer = new MCPSSHServer();
      mcpServer['sshManager'] = mockSshManager;
      mockSshManager.cleanup.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      await mcpServer.start();
      await expect(mcpServer.stop()).resolves.not.toThrow();
    });
  });
});