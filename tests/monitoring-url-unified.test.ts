import { UnifiedMCPServer } from '../src/unified-mcp-server';

describe('ssh_get_monitoring_url with Unified Server', () => {
  let server: UnifiedMCPServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Returns existing server URL', () => {
    it('should return URL of already-running unified server', async () => {
      server = new UnifiedMCPServer({ webPort: 9500 });
      await server.start();
      const sshManager = server.getSSHConnectionManager();
      
      // Mock SSH session exists
      jest.spyOn(sshManager, 'hasSession').mockReturnValue(true);

      const initialServerCount = server.getActiveServerCount();
      const serverPort = await server.getPort();

      // Call ssh_get_monitoring_url
      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      // Should return URL of existing server
      expect(result.success).toBe(true);
      expect(result.monitoringUrl).toBe(`http://localhost:${serverPort}/session/test-session`);
      
      // Should NOT start a new server
      expect(server.getActiveServerCount()).toBe(initialServerCount);
    });

    it('should not try to start web server when already running', async () => {
      server = new UnifiedMCPServer({ webPort: 9501 });
      await server.start();
      const sshManager = server.getSSHConnectionManager();
      
      // Mock session exists
      jest.spyOn(sshManager, 'hasSession').mockReturnValue(true);
      
      const isRunning = server.isWebServerRunning();
      expect(isRunning).toBe(true); // Server should already be running
      
      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      expect(result.success).toBe(true);
    });

    it('should handle multiple concurrent monitoring URL requests', async () => {
      server = new UnifiedMCPServer({ webPort: 9502 });
      await server.start();
      const sshManager = server.getSSHConnectionManager();
      
      // Mock multiple sessions
      jest.spyOn(sshManager, 'hasSession').mockReturnValue(true);
      
      const initialServerCount = server.getActiveServerCount();
      const serverPort = await server.getPort();

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        server.callTool('ssh_get_monitoring_url', {
          sessionName: `test-session-${i}`
        })
      );

      const results = await Promise.all(promises);

      // All should return URLs from same server
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.monitoringUrl).toBe(
          `http://localhost:${serverPort}/session/test-session-${i}`
        );
      });

      // Should still have same number of servers (no new ones started)
      expect(server.getActiveServerCount()).toBe(initialServerCount);
    });

    it('should fail gracefully when session does not exist', async () => {
      server = new UnifiedMCPServer({ webPort: 9503 });
      await server.start();
      const sshManager = server.getSSHConnectionManager();
      
      jest.spyOn(sshManager, 'hasSession').mockReturnValue(false);

      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'nonexistent-session'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session \'nonexistent-session\' not found');
    });
  });

  describe('Legacy compatibility', () => {
    it('should maintain same response format as before', async () => {
      server = new UnifiedMCPServer({ webPort: 9504 });
      await server.start();
      const sshManager = server.getSSHConnectionManager();
      
      jest.spyOn(sshManager, 'hasSession').mockReturnValue(true);

      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      // Response should match expected format
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('sessionName');
      expect(result).toHaveProperty('monitoringUrl');
      expect(result.sessionName).toBe('test-session');
      expect(typeof result.monitoringUrl).toBe('string');
    });
  });

  describe('Error handling', () => {
    it('should handle server startup failures gracefully', async () => {
      // Test with invalid port - constructor should throw
      expect(() => new UnifiedMCPServer({ webPort: -1 }))
        .toThrow('Invalid port: must be between 1 and 65535');
    });

    it('should handle SSH manager errors', async () => {
      server = new UnifiedMCPServer({ webPort: 9505 });
      await server.start();
      const sshManager = server.getSSHConnectionManager();
      
      jest.spyOn(sshManager, 'hasSession').mockImplementation(() => {
        throw new Error('SSH manager error');
      });

      const result = await server.callTool('ssh_get_monitoring_url', {
        sessionName: 'test-session'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SSH manager error');
    });
  });
});