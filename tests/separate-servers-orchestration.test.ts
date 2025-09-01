/**
 * Test suite for main server orchestration - manages both MCP and Web servers
 * This tests the coordination between separate MCP and Web servers
 */

import { MCPServer } from '../src/mcp-server.js';
import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Separate Servers Orchestration', () => {
  let mainServer: MCPServer;
  let mockMCPServer: any;
  let mockWebServer: any;
  let mockSshManager: any;
  let mockPortManager: any;

  beforeEach(() => {
    mockSshManager = {
      createConnection: jest.fn(),
      executeCommand: jest.fn(),
      listSessions: jest.fn(),
      disconnectSession: jest.fn(),
      hasSession: jest.fn(),
      cleanup: jest.fn(),
      updateWebServerPort: jest.fn(),
    };

    mockMCPServer = {
      start: jest.fn(),
      stop: jest.fn(),
      isMCPRunning: jest.fn().mockReturnValue(true),
      setWebServerPort: jest.fn(),
      getSSHConnectionManager: jest.fn().mockReturnValue(mockSshManager),
      listTools: jest.fn(() => Promise.resolve(['ssh_connect', 'ssh_exec'])),
      callTool: jest.fn(),
    };

    mockWebServer = {
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn().mockReturnValue(true),
      getPort: jest.fn(() => Promise.resolve(8080)),
    };

    mockPortManager = {
      getUnifiedPort: jest.fn(() => Promise.resolve(8080)),
      reservePort: jest.fn(() => Promise.resolve(8080)),
      releasePort: jest.fn(),
    };
  });

  afterEach(async () => {
    if (mainServer) {
      await mainServer.stop();
    }
    // Clean up port file if exists
    try {
      await fs.promises.unlink(path.join(process.cwd(), '.ssh-mcp-server.port'));
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      mainServer = new MCPServer();
      expect(mainServer).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const config = {
        webPort: 9000,
        sshTimeout: 20000,
        maxSessions: 5
      };
      mainServer = new MCPServer(config);
      expect(mainServer).toBeDefined();
    });

    it('should validate configuration parameters', () => {
      expect(() => new MCPServer({ webPort: -1 }))
        .toThrow('Invalid port: must be between 1 and 65535');
      expect(() => new MCPServer({ sshTimeout: -1 }))
        .toThrow('Invalid ssh timeout');
      expect(() => new MCPServer({ maxSessions: 0 }))
        .toThrow('Invalid max sessions');
    });
  });

  describe('Server Startup Orchestration', () => {
    beforeEach(() => {
      mainServer = new MCPServer();
      // Inject mocked components for testing
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
    });

    it('should start both servers in correct sequence', async () => {
      await mainServer.start();

      expect(mockPortManager.getUnifiedPort).toHaveBeenCalledWith(8080);
      expect(mockMCPServer.setWebServerPort).toHaveBeenCalledWith(8080);
      expect(mockWebServer.start).toHaveBeenCalled();
      expect(mockMCPServer.start).toHaveBeenCalled();
      
      expect(mainServer.isMCPRunning()).toBe(true);
      expect(mainServer.isWebServerRunning()).toBe(true);
    });

    it('should coordinate port discovery between servers', async () => {
      mockPortManager.getUnifiedPort.mockResolvedValue(9001);
      mockWebServer.getPort.mockResolvedValue(9001);

      await mainServer.start();

      expect(mockPortManager.getUnifiedPort).toHaveBeenCalledWith(8080);
      expect(mockMCPServer.setWebServerPort).toHaveBeenCalledWith(9001);
    });

    it('should write port to file after successful startup', async () => {
      mockPortManager.getUnifiedPort.mockResolvedValue(8085);
      
      await mainServer.start();

      const portFilePath = path.join(process.cwd(), '.ssh-mcp-server.port');
      const portFileContent = await fs.promises.readFile(portFilePath, 'utf8');
      expect(portFileContent).toBe('8085');
    });

    it('should handle web server startup failure gracefully', async () => {
      mockWebServer.start.mockRejectedValue(new Error('Web server startup failed'));

      await expect(mainServer.start()).rejects.toThrow('Web server startup failed');
      expect(mockMCPServer.stop).toHaveBeenCalled(); // Should cleanup MCP server
    });

    it('should handle MCP server startup failure gracefully', async () => {
      mockMCPServer.start.mockRejectedValue(new Error('MCP server startup failed'));

      await expect(mainServer.start()).rejects.toThrow('MCP server startup failed');
      expect(mockWebServer.stop).toHaveBeenCalled(); // Should cleanup web server
    });

    it('should use specified port when provided in config', async () => {
      const config = { webPort: 9500 };
      mainServer = new MCPServer(config);
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      
      mockPortManager.reservePort.mockResolvedValue(9500);
      
      await mainServer.start();

      expect(mockPortManager.reservePort).toHaveBeenCalledWith(9500);
      expect(mockMCPServer.setWebServerPort).toHaveBeenCalledWith(9500);
    });
  });

  describe('Server Communication Coordination', () => {
    beforeEach(async () => {
      mainServer = new MCPServer();
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      await mainServer.start();
    });

    it('should provide unified SSH connection manager access', () => {
      const sshManager = mainServer.getSSHConnectionManager();
      expect(sshManager).toBe(mockSshManager);
    });

    it('should coordinate SSH session data between servers', async () => {
      // Web server should have access to SSH manager from MCP server
      expect(mockMCPServer.getSSHConnectionManager).toHaveBeenCalled();
    });

    it('should provide unified tool interface', async () => {
      const tools = await mainServer.listTools();
      expect(mockMCPServer.listTools).toHaveBeenCalled();
      expect(tools).toContain('ssh_connect');
      expect(tools).toContain('ssh_exec');
    });

    it('should delegate tool calls to MCP server', async () => {
      const mockResult = { success: true, connection: { name: 'test' } };
      mockMCPServer.callTool.mockResolvedValue(mockResult);

      const result = await mainServer.callTool('ssh_connect', {
        name: 'test',
        host: 'localhost',
        username: 'user',
        password: 'pass'
      });

      expect(mockMCPServer.callTool).toHaveBeenCalledWith('ssh_connect', {
        name: 'test',
        host: 'localhost',
        username: 'user',
        password: 'pass'
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('Port Management', () => {
    it('should return correct ports for both servers', async () => {
      mainServer = new MCPServer();
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      
      mockWebServer.getPort.mockResolvedValue(8080);
      
      await mainServer.start();

      const webPort = await mainServer.getWebPort();
      expect(webPort).toBe(8080);
      
      // MCP server doesn't use port (stdio), but coordinator should track it
      const mcpPort = mainServer.getMCPPort();
      expect(mcpPort).toBe(0); // MCP uses stdio, no port
    });

    it('should handle port conflicts during startup', async () => {
      mainServer = new MCPServer({ webPort: 8080 });
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      
      mockPortManager.reservePort.mockRejectedValue(new Error('Port 8080 already in use'));

      await expect(mainServer.start()).rejects.toThrow('Port 8080 already in use');
    });
  });

  describe('Server Status Monitoring', () => {
    beforeEach(async () => {
      mainServer = new MCPServer();
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      await mainServer.start();
    });

    it('should report correct server count', () => {
      const count = mainServer.getActiveServerCount();
      expect(count).toBe(2); // MCP + Web servers
    });

    it('should report individual server status', () => {
      expect(mainServer.isMCPRunning()).toBe(true);
      expect(mainServer.isWebServerRunning()).toBe(true);
    });

    it('should report partial startup failures correctly', async () => {
      mockMCPServer.isMCPRunning.mockReturnValue(false);
      
      expect(mainServer.isMCPRunning()).toBe(false);
      expect(mainServer.isWebServerRunning()).toBe(true);
      expect(mainServer.getActiveServerCount()).toBe(1);
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(async () => {
      mainServer = new MCPServer();
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      await mainServer.start();
    });

    it('should stop both servers gracefully', async () => {
      await mainServer.stop();

      expect(mockMCPServer.stop).toHaveBeenCalled();
      expect(mockWebServer.stop).toHaveBeenCalled();
      expect(mockPortManager.releasePort).toHaveBeenCalledWith(8080);
    });

    it('should remove port file on shutdown', async () => {
      // Verify port file exists
      const portFilePath = path.join(process.cwd(), '.ssh-mcp-server.port');
      expect(await fs.promises.access(portFilePath)).resolves;

      await mainServer.stop();

      // Verify port file is removed
      await expect(fs.promises.access(portFilePath)).rejects.toThrow();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockMCPServer.stop.mockRejectedValue(new Error('MCP stop error'));
      mockWebServer.stop.mockRejectedValue(new Error('Web stop error'));

      // Should not throw, should handle errors gracefully
      await expect(mainServer.stop()).resolves.not.toThrow();
    });

    it('should cleanup SSH connections on shutdown', async () => {
      await mainServer.stop();
      expect(mockSshManager.cleanup).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should handle MCP server crash', async () => {
      mainServer = new MCPServer();
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      
      await mainServer.start();
      
      // Simulate MCP server crash
      mockMCPServer.isMCPRunning.mockReturnValue(false);
      
      expect(mainServer.isMCPRunning()).toBe(false);
      expect(mainServer.isWebServerRunning()).toBe(true);
      expect(mainServer.getActiveServerCount()).toBe(1);
    });

    it('should handle web server crash', async () => {
      mainServer = new MCPServer();
      (mainServer as any).mcpServer = mockMCPServer;
      (mainServer as any).webServer = mockWebServer;
      (mainServer as any).portManager = mockPortManager;
      
      await mainServer.start();
      
      // Simulate web server crash
      mockWebServer.isRunning.mockReturnValue(false);
      
      expect(mainServer.isMCPRunning()).toBe(true);
      expect(mainServer.isWebServerRunning()).toBe(false);
      expect(mainServer.getActiveServerCount()).toBe(1);
    });
  });
});