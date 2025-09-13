/**
 * TDD Reproduction Test: WebSocket Authentication 401 Errors
 * 
 * CRITICAL BUG: WebSocket connections failing with "Unexpected server response: 401"
 * Root Cause: verifyClient function in WebSocket server rejecting connections 
 * when SSH sessions don't exist or aren't properly registered.
 * 
 * This test reproduces the exact failure scenario using real components.
 */

import { MCPSSHServer } from "../src/mcp-ssh-server.js";
import { WebServerManager } from "../src/web-server-manager.js";
import { SSHConnectionManager } from "../src/ssh-connection-manager.js";
import WebSocket from "ws";

describe("WebSocket Authentication - TDD Reproduction", () => {
  let mcpServer: MCPSSHServer;
  let webServer: WebServerManager;
  let sshManager: SSHConnectionManager;
  
  beforeEach(() => {
    // Create shared SSH connection manager
    sshManager = new SSHConnectionManager(8080);
    
    // Create MCP server with shared manager
    mcpServer = new MCPSSHServer({}, sshManager);
    
    // Create web server with shared manager
    webServer = new WebServerManager(sshManager);
  });

  afterEach(async () => {
    // Clean shutdown
    try {
      if (mcpServer) await mcpServer.stop();
      if (webServer) await webServer.stop();
    } catch (error) {
      console.error("Test cleanup error:", error);
    }
  });

  describe("FAILING TEST - WebSocket Authentication Issues", () => {
    it("should reject WebSocket connections for non-existent sessions", async () => {
      // FAILING TEST: This should properly reject with 401
      
      // Start web server only (no SSH sessions created)
      await webServer.start();
      const webPort = await webServer.getPort();
      
      // Attempt to connect to non-existent session
      const wsUrl = `ws://localhost:${webPort}/ws/session/non-existent-session`;
      
      const connectionPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
        const ws = new WebSocket(wsUrl);
        
        ws.on('open', () => {
          ws.close();
          resolve({ success: true });
        });
        
        ws.on('error', (error: any) => {
          // Should get 401 Unauthorized error
          const errorMessage = error.message || String(error);
          resolve({ success: false, error: errorMessage });
        });
        
        ws.on('close', (code) => {
          if (code === 1002 || code === 1006) {
            // WebSocket close codes for unauthorized/abnormal closure
            resolve({ success: false, error: `WebSocket closed with code: ${code}` });
          }
        });
      });

      const result = await connectionPromise;
      
      // ASSERTION: Connection should fail with proper error
      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    }, 10000);

    it("should allow WebSocket connections for existing sessions", async () => {
      // FAILING TEST: This should work when session exists
      
      // Start both servers
      await webServer.start();
      const webPort = await webServer.getPort();
      await mcpServer.start();
      mcpServer.setWebServerPort(webPort);
      
      // Create SSH session through MCP
      const connectionResult = await mcpServer.callTool('ssh_connect', {
        name: 'test-session',
        host: 'localhost',
        username: 'jsbattig',
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });
      
      // Verify session was created
      expect(connectionResult).toHaveProperty('success', true);
      
      // Now try WebSocket connection to existing session
      const wsUrl = `ws://localhost:${webPort}/ws/session/test-session`;
      
      const connectionPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Connection timeout' });
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({ success: true });
        });
        
        ws.on('error', (error: any) => {
          clearTimeout(timeout);
          const errorMessage = error.message || String(error);
          resolve({ success: false, error: errorMessage });
        });
      });

      const result = await connectionPromise;
      
      // ASSERTION: Connection should succeed for existing session
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    }, 15000);

    it("should handle WebSocket session validation race conditions", async () => {
      // FAILING TEST: Race condition between session creation and WebSocket connection
      
      await webServer.start();
      const webPort = await webServer.getPort();
      await mcpServer.start();
      mcpServer.setWebServerPort(webPort);
      
      // Start WebSocket connection attempt immediately after session creation
      const sessionName = 'race-test-session';
      
      // Create session and immediately try to connect WebSocket
      const [connectionResult, wsResult] = await Promise.all([
        mcpServer.callTool('ssh_connect', {
          name: sessionName,
          host: 'localhost', 
          username: 'jsbattig',
          keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
        }),
        new Promise<{ success: boolean; error?: string }>((resolve) => {
          // Small delay to simulate real timing
          setTimeout(() => {
            const wsUrl = `ws://localhost:${webPort}/ws/session/${sessionName}`;
            const ws = new WebSocket(wsUrl);
            
            const timeout = setTimeout(() => {
              ws.close();
              resolve({ success: false, error: 'Connection timeout' });
            }, 3000);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              ws.close();
              resolve({ success: true });
            });
            
            ws.on('error', (error: any) => {
              clearTimeout(timeout);
              const errorMessage = error.message || String(error);
              resolve({ success: false, error: errorMessage });
            });
          }, 100);
        })
      ]);
      
      // ASSERTIONS: Both should succeed without race conditions
      expect(connectionResult).toHaveProperty('success', true);
      expect(wsResult.success).toBe(true);
    }, 15000);
  });

  describe("WebSocket Session Management", () => {
    it("should properly register sessions for WebSocket verification", async () => {
      // Verify that SSH sessions are properly registered for WebSocket access
      
      await webServer.start();
      const webPort = await webServer.getPort();
      await mcpServer.start();
      mcpServer.setWebServerPort(webPort);
      
      const sessionName = 'verification-test';
      
      // Before session creation - should not exist
      expect(sshManager.hasSession(sessionName)).toBe(false);
      
      // Create session
      const result = await mcpServer.callTool('ssh_connect', {
        name: sessionName,
        host: 'localhost',
        username: 'jsbattig', 
        keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
      });
      
      expect(result).toHaveProperty('success', true);
      
      // After session creation - should exist
      expect(sshManager.hasSession(sessionName)).toBe(true);
      
      // Cleanup
      await mcpServer.callTool('ssh_disconnect', { sessionName });
      
      // After cleanup - should not exist
      expect(sshManager.hasSession(sessionName)).toBe(false);
    }, 12000);
  });
});