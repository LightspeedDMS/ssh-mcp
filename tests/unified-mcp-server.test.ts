import { UnifiedMCPServer } from '../src/unified-mcp-server';
import * as net from 'net';

describe('UnifiedMCPServer', () => {
  describe('Constructor and Initialization', () => {
    it('should create unified server with single port discovery', () => {
      const server = new UnifiedMCPServer({ webPort: 9400 });
      expect(server).toBeInstanceOf(UnifiedMCPServer);
    });

    it('should reject invalid port ranges', () => {
      expect(() => new UnifiedMCPServer({ webPort: 0 })).toThrow('Invalid port');
      expect(() => new UnifiedMCPServer({ webPort: 70000 })).toThrow('Invalid port');
    });
  });

  describe('Single Server Architecture', () => {
    let server: UnifiedMCPServer;

    beforeEach(() => {
      server = new UnifiedMCPServer({ webPort: 0 }); // Auto-discover
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should start MCP server and web server on same port', async () => {
      await server.start();
      
      const port = await server.getPort();
      expect(port).toBeGreaterThan(1000);
      
      // Verify HTTP server is accessible
      const response = await fetch(`http://localhost:${port}/`);
      expect(response.status).toBe(200);
      
      // Verify MCP server is running
      expect(server.isMCPRunning()).toBe(true);
      expect(server.isWebServerRunning()).toBe(true);
    });

    it('should start web server immediately with MCP server', async () => {
      const startTime = Date.now();
      await server.start();
      const endTime = Date.now();
      
      // Both servers should start together quickly
      expect(endTime - startTime).toBeLessThan(1000);
      expect(server.isMCPRunning()).toBe(true);
      expect(server.isWebServerRunning()).toBe(true);
    });

    it('should use single port discovery mechanism', async () => {
      await server.start();
      const mcpPort = server.getMCPPort();
      const webPort = server.getWebPort();
      
      expect(mcpPort).toBe(webPort);
    });

    it('should handle port conflicts gracefully', async () => {
      // Create a server to occupy a port
      const conflictServer = net.createServer();
      await new Promise<void>((resolve) => {
        conflictServer.listen(8080, resolve);
      });

      try {
        const server1 = new UnifiedMCPServer({ webPort: 8080 });
        await expect(server1.start()).rejects.toThrow('Port 8080 is already in use');
      } finally {
        conflictServer.close();
      }
    });
  });

  describe('MCP Protocol Integration', () => {
    let server: UnifiedMCPServer;

    beforeEach(async () => {
      server = new UnifiedMCPServer({ webPort: 0 });
      await server.start();
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should handle MCP tool calls on unified server', async () => {
      const tools = await server.listTools();
      expect(tools).toContain('ssh_connect');
      expect(tools).toContain('ssh_get_monitoring_url');
    });

    it('should execute ssh_get_monitoring_url without starting new server', async () => {
      const initialServerCount = server.getActiveServerCount();
      
      // Mock SSH connection
      const mockSSH = server.getSSHConnectionManager();
      await mockSSH.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'test',
        password: 'test'
      });

      const result = await server.callTool('ssh_get_monitoring_url', { 
        sessionName: 'test-session' 
      });

      expect(result.success).toBe(true);
      expect(result.monitoringUrl).toContain(`http://localhost:${await server.getPort()}`);
      expect(server.getActiveServerCount()).toBe(initialServerCount); // No new servers
    });
  });

  describe('WebSocket Integration', () => {
    let server: UnifiedMCPServer;

    beforeEach(async () => {
      server = new UnifiedMCPServer({ webPort: 0 });
      await server.start();
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('should support WebSocket connections on unified server', async () => {
      const port = await server.getPort();
      const ws = new WebSocket(`ws://localhost:${port}/ws/monitoring`);
      
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = reject;
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('should support session-specific WebSocket endpoints', async () => {
      const port = await server.getPort();
      
      // Mock SSH session
      const mockSSH = server.getSSHConnectionManager();
      await mockSSH.createConnection({
        name: 'test-session',
        host: 'localhost', 
        username: 'test',
        password: 'test'
      });

      const ws = new WebSocket(`ws://localhost:${port}/ws/session/test-session`);
      
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = reject;
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should stop all components gracefully', async () => {
      const server = new UnifiedMCPServer({ webPort: 0 });
      await server.start();
      
      expect(server.isMCPRunning()).toBe(true);
      expect(server.isWebServerRunning()).toBe(true);
      
      await server.stop();
      
      expect(server.isMCPRunning()).toBe(false);
      expect(server.isWebServerRunning()).toBe(false);
    });

    it('should cleanup SSH connections on shutdown', async () => {
      const server = new UnifiedMCPServer({ webPort: 0 });
      await server.start();
      
      const mockSSH = server.getSSHConnectionManager();
      await mockSSH.createConnection({
        name: 'test-session',
        host: 'localhost',
        username: 'test',
        password: 'test'
      });

      expect(mockSSH.listSessions()).toHaveLength(1);
      
      await server.stop();
      
      expect(mockSSH.listSessions()).toHaveLength(0);
    });
  });
});