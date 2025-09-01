/**
 * Test suite for WebServerManager - Pure HTTP/WebSocket server 
 * This server should handle only web interface without MCP functionality
 */

import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { jest } from '@jest/globals';
import * as http from 'http';
import axios from 'axios';
import WebSocket from 'ws';

describe('WebServerManager', () => {
  let webServer: WebServerManager;
  let mockSshManager: jest.Mocked<SSHConnectionManager>;

  beforeEach(() => {
    mockSshManager = {
      hasSession: jest.fn(),
      addTerminalOutputListener: jest.fn(),
      removeTerminalOutputListener: jest.fn(),
      cleanup: jest.fn(),
    } as any;
  });

  afterEach(async () => {
    if (webServer) {
      await webServer.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with SSH manager', () => {
      webServer = new WebServerManager(mockSshManager);
      expect(webServer).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const config = { port: 9000 };
      webServer = new WebServerManager(mockSshManager, config);
      expect(webServer).toBeDefined();
    });

    it('should validate port configuration', () => {
      expect(() => new WebServerManager(mockSshManager, { port: -1 }))
        .toThrow('Invalid port: must be between 1 and 65535');
      expect(() => new WebServerManager(mockSshManager, { port: 70000 }))
        .toThrow('Invalid port: must be between 1 and 65535');
    });
  });

  describe('HTTP Server Functionality', () => {
    beforeEach(() => {
      webServer = new WebServerManager(mockSshManager);
    });

    it('should start HTTP server on discovered port', async () => {
      await webServer.start();
      const port = await webServer.getPort();
      
      expect(port).toBeGreaterThan(0);
      expect(webServer.isRunning()).toBe(true);
    });

    it('should serve root route', async () => {
      await webServer.start();
      const port = await webServer.getPort();
      
      const response = await axios.get(`http://localhost:${port}/`);
      expect(response.status).toBe(200);
      expect(response.data).toContain('SSH MCP Server');
      expect(response.data).toContain(`port ${port}`);
    });

    it('should serve session-specific routes', async () => {
      mockSshManager.hasSession.mockReturnValue(true);
      
      await webServer.start();
      const port = await webServer.getPort();
      
      const response = await axios.get(`http://localhost:${port}/session/test-session`);
      expect(response.status).toBe(200);
      expect(response.data).toContain('SSH Session: test-session');
      expect(response.data).toContain(`ws://localhost:${port}/ws/session/test-session`);
    });

    it('should return 404 for non-existent sessions', async () => {
      mockSshManager.hasSession.mockReturnValue(false);
      
      await webServer.start();
      const port = await webServer.getPort();
      
      try {
        await axios.get(`http://localhost:${port}/session/non-existent`);
        fail('Expected 404 error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toBe('Session not found');
      }
    });

    it('should NOT have MCP server capabilities', () => {
      expect(() => (webServer as any).isMCPRunning()).toThrow('MCP functionality not available');
      expect(() => (webServer as any).getMCPPort()).toThrow('MCP functionality not available');
    });
  });

  describe('WebSocket Server Functionality', () => {
    beforeEach(() => {
      webServer = new WebServerManager(mockSshManager);
    });

    it('should accept WebSocket connections to monitoring endpoint', async () => {
      await webServer.start();
      const port = await webServer.getPort();
      
      const ws = new WebSocket(`ws://localhost:${port}/ws/monitoring`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });

    it('should accept WebSocket connections to valid session endpoints', async () => {
      mockSshManager.hasSession.mockReturnValue(true);
      
      await webServer.start();
      const port = await webServer.getPort();
      
      const ws = new WebSocket(`ws://localhost:${port}/ws/session/test-session`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });

    it('should reject WebSocket connections to invalid session endpoints', async () => {
      mockSshManager.hasSession.mockReturnValue(false);
      
      await webServer.start();
      const port = await webServer.getPort();
      
      const ws = new WebSocket(`ws://localhost:${port}/ws/session/invalid`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          reject(new Error('Connection should have been rejected'));
        });
        ws.on('error', () => {
          resolve(); // Expected behavior
        });
        setTimeout(() => resolve(), 1000); // Connection should be rejected quickly
      });
    });

    it('should setup session terminal output listeners', async () => {
      mockSshManager.hasSession.mockReturnValue(true);
      
      await webServer.start();
      const port = await webServer.getPort();
      
      const ws = new WebSocket(`ws://localhost:${port}/ws/session/test-session`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(mockSshManager.addTerminalOutputListener).toHaveBeenCalledWith(
            'test-session',
            expect.any(Function)
          );
          ws.close();
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });
  });

  describe('Port Management', () => {
    it('should use specified port when provided', async () => {
      webServer = new WebServerManager(mockSshManager, { port: 9001 });
      await webServer.start();
      
      const port = await webServer.getPort();
      expect(port).toBe(9001);
    });

    it('should auto-discover port when not specified', async () => {
      webServer = new WebServerManager(mockSshManager);
      await webServer.start();
      
      const port = await webServer.getPort();
      expect(port).toBeGreaterThan(8079); // Should start searching from 8080
      expect(port).toBeLessThan(65536);
    });

    it('should fail to start if specified port is in use', async () => {
      // Start first server on specific port
      const firstServer = new WebServerManager(mockSshManager, { port: 9002 });
      await firstServer.start();
      
      try {
        // Try to start second server on same port
        webServer = new WebServerManager(mockSshManager, { port: 9002 });
        await expect(webServer.start()).rejects.toThrow('already in use');
      } finally {
        await firstServer.stop();
      }
    });
  });

  describe('Static File Serving', () => {
    beforeEach(async () => {
      webServer = new WebServerManager(mockSshManager);
      await webServer.start();
    });

    it('should serve static files from static directory', async () => {
      const port = await webServer.getPort();
      
      // Test static file serving by requesting non-existent file
      try {
        await axios.get(`http://localhost:${port}/non-existent.css`);
        fail('Should return 404 for non-existent file');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP server startup errors', async () => {
      // Mock HTTP server to simulate error
      webServer = new WebServerManager(mockSshManager, { port: 9003 });
      
      // Simulate port already in use by creating a simple server
      const blockerServer = http.createServer();
      blockerServer.listen(9003);
      
      try {
        await expect(webServer.start()).rejects.toThrow('already in use');
      } finally {
        blockerServer.close();
      }
    });

    it('should handle WebSocket errors gracefully', async () => {
      mockSshManager.hasSession.mockReturnValue(true);
      mockSshManager.addTerminalOutputListener.mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      await webServer.start();
      const port = await webServer.getPort();
      
      // This should not crash the server
      const ws = new WebSocket(`ws://localhost:${port}/ws/session/test-session`);
      
      return new Promise<void>((resolve) => {
        ws.on('open', () => {
          // Server should still be running
          expect(webServer.isRunning()).toBe(true);
          ws.close();
          resolve();
        });
        ws.on('error', resolve); // Error is expected and handled
        setTimeout(() => resolve(), 2000);
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources on stop', async () => {
      webServer = new WebServerManager(mockSshManager);
      await webServer.start();
      
      expect(webServer.isRunning()).toBe(true);
      
      await webServer.stop();
      
      expect(webServer.isRunning()).toBe(false);
      // Port should be released and available for reuse
    });

    it('should handle stop when not running', async () => {
      webServer = new WebServerManager(mockSshManager);
      
      // Should not throw error
      await expect(webServer.stop()).resolves.not.toThrow();
    });

    it('should cleanup WebSocket connections on stop', async () => {
      webServer = new WebServerManager(mockSshManager);
      await webServer.start();
      
      const port = await webServer.getPort();
      const ws = new WebSocket(`ws://localhost:${port}/ws/monitoring`);
      
      return new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          // Stop server while WebSocket is connected
          await webServer.stop();
          
          // WebSocket should be closed
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Test timeout')), 5000);
      });
    });
  });
});