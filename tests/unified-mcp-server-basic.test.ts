import { UnifiedMCPServer } from '../src/unified-mcp-server';

describe('UnifiedMCPServer Basic Tests', () => {
  describe('Constructor and Configuration', () => {
    it('should create unified server with valid configuration', () => {
      const server = new UnifiedMCPServer({ webPort: 9400 });
      expect(server).toBeInstanceOf(UnifiedMCPServer);
      
      const config = server.getConfig();
      expect(config.webPort).toBe(9400);
    });

    it('should use default configuration when no config provided', () => {
      const server = new UnifiedMCPServer();
      const config = server.getConfig();
      
      expect(config.sshTimeout).toBe(30000);
      expect(config.maxSessions).toBe(10);
      expect(config.logLevel).toBe('info');
    });

    it('should reject invalid port ranges', () => {
      expect(() => new UnifiedMCPServer({ webPort: 0 })).toThrow('Invalid port');
      expect(() => new UnifiedMCPServer({ webPort: 70000 })).toThrow('Invalid port');
      expect(() => new UnifiedMCPServer({ webPort: -1 })).toThrow('Invalid port');
    });

    it('should merge provided config with defaults', () => {
      const server = new UnifiedMCPServer({ 
        webPort: 9401, 
        sshTimeout: 60000 
      });
      const config = server.getConfig();
      
      expect(config.webPort).toBe(9401);
      expect(config.sshTimeout).toBe(60000);
      expect(config.maxSessions).toBe(10); // default
      expect(config.logLevel).toBe('info'); // default
    });
  });

  describe('Server State Management', () => {
    let server: UnifiedMCPServer;

    beforeEach(() => {
      server = new UnifiedMCPServer({ webPort: 9410 });
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should have correct initial state', () => {
      expect(server.isMCPRunning()).toBe(false);
      expect(server.isWebServerRunning()).toBe(false);
      expect(server.getActiveServerCount()).toBe(0);
    });

    it('should provide access to SSH connection manager', () => {
      const sshManager = server.getSSHConnectionManager();
      expect(sshManager).toBeDefined();
      expect(typeof sshManager.hasSession).toBe('function');
      expect(typeof sshManager.listSessions).toBe('function');
    });

    it('should have MCP tools available', async () => {
      const tools = await server.listTools();
      expect(tools).toContain('ssh_connect');
      expect(tools).toContain('ssh_exec');
      expect(tools).toContain('ssh_list_sessions');
      expect(tools).toContain('ssh_disconnect');
      expect(tools).toContain('ssh_get_monitoring_url');
    });
  });

  describe('Port Management', () => {
    it('should throw error when getting port before server start', async () => {
      const server = new UnifiedMCPServer();
      await expect(server.getPort()).rejects.toThrow('Server not started');
    });

    it('should return 0 for MCP and web ports before start', () => {
      const server = new UnifiedMCPServer();
      expect(server.getMCPPort()).toBe(0);
      expect(server.getWebPort()).toBe(0);
    });
  });

  describe('SSH Tool Integration', () => {
    let server: UnifiedMCPServer;

    beforeEach(() => {
      server = new UnifiedMCPServer({ webPort: 9420 });
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should handle ssh_list_sessions tool call', async () => {
      const result = await server.callTool('ssh_list_sessions', {});
      
      expect(result.success).toBe(true);
      expect(result.sessions).toBeDefined();
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('should handle invalid tool calls', async () => {
      const result = await server.callTool('nonexistent_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should validate required parameters for ssh_connect', async () => {
      const result = await server.callTool('ssh_connect', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should validate required parameters for ssh_exec', async () => {
      const result = await server.callTool('ssh_exec', { sessionName: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should validate required parameters for ssh_disconnect', async () => {
      const result = await server.callTool('ssh_disconnect', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    it('should validate required parameters for ssh_get_monitoring_url', async () => {
      const result = await server.callTool('ssh_get_monitoring_url', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });
  });

  describe('Monitoring URL Generation', () => {
    let server: UnifiedMCPServer;

    beforeEach(async () => {
      server = new UnifiedMCPServer({ webPort: 9430 });
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should reject monitoring URL request when web server not running', async () => {
      // Mock session existence
      jest.spyOn(server.getSSHConnectionManager(), 'hasSession').mockReturnValue(true);
      
      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Web server not running');
    });

    it('should reject monitoring URL for nonexistent session', async () => {
      // Mock session doesn't exist
      jest.spyOn(server.getSSHConnectionManager(), 'hasSession').mockReturnValue(false);
      
      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'nonexistent-session'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session \'nonexistent-session\' not found');
    });
  });
});