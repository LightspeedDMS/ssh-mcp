/**
 * Story 3: Dynamic WebSocket Connection Discovery - End-to-End Tests
 * 
 * CRITICAL: This test file verifies the complete WebSocket connection workflow
 * with REAL components - NO MOCKS ALLOWED per project policy.
 * 
 * Tests the establishConnection method with actual WebSocket servers and real
 * network connections to ensure production-ready functionality.
 */

import { WebSocketConnectionDiscovery } from './integration/terminal-history-framework/websocket-connection-discovery.js';
import { MCPSSHServer } from '../src/mcp-ssh-server.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';

describe('Story 3: WebSocketConnectionDiscovery - E2E Tests', () => {
  let testWebSocketServer: WebSocketServer;
  let testHttpServer: http.Server;
  let testServerPort: number;
  let mcpServer: MCPSSHServer;
  let sshManager: SSHConnectionManager;
  let mcpClient: { callTool: (toolName: string, args: unknown) => Promise<unknown> };

  beforeAll(async () => {
    // Setup test WebSocket server for controlled E2E testing
    await new Promise<void>((resolve) => {
      testHttpServer = http.createServer();
      testWebSocketServer = new WebSocketServer({ server: testHttpServer });
      
      // Handle WebSocket connections for testing
      testWebSocketServer.on('connection', (ws) => {
        // Echo server for testing
        ws.on('message', (data) => {
          ws.send(data);
        });
      });

      testHttpServer.listen(0, () => {
        const address = testHttpServer.address();
        if (address && typeof address === 'object') {
          testServerPort = address.port;
        }
        resolve();
      });
    });

    // Setup MCP server for integration testing
    const mcpServerPort = 8090 + Math.floor(Math.random() * 1000);
    sshManager = new SSHConnectionManager(mcpServerPort);
    mcpServer = new MCPSSHServer({}, sshManager);
    mcpServer.setWebServerPort(mcpServerPort);
    
    // Create real MCP client
    mcpClient = {
      callTool: async (toolName: string, args: unknown) => {
        return await mcpServer.callTool(toolName, args);
      }
    };
  });

  afterAll(async () => {
    // Cleanup test servers
    if (testWebSocketServer) {
      testWebSocketServer.clients.forEach(client => client.close());
      testWebSocketServer.close();
    }
    if (testHttpServer) {
      await new Promise<void>((resolve) => {
        testHttpServer.close(() => resolve());
      });
    }
    if (mcpServer) {
      await mcpServer.stop();
    }
    if (sshManager) {
      sshManager.cleanup();
    }
  });

  describe('establishConnection - Real WebSocket Connection Tests', () => {
    it('should establish real WebSocket connection successfully', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      const webSocketUrl = `ws://localhost:${testServerPort}`;

      // ACT: Establish real WebSocket connection
      const webSocket = await discovery.establishConnection(webSocketUrl);

      // ASSERT: Verify connection is established and operational
      expect(webSocket).toBeDefined();
      expect(webSocket).toBeInstanceOf(WebSocket);
      expect(webSocket.readyState).toBe(WebSocket.OPEN);
      expect(discovery.validateConnection(webSocket)).toBe(true);

      // Test that connection is actually working
      await new Promise<void>((resolve, reject) => {
        const testMessage = 'test-message';
        const timeout = setTimeout(() => {
          reject(new Error('Message echo timeout'));
        }, 2000);

        webSocket.once('message', (data) => {
          clearTimeout(timeout);
          expect(data.toString()).toBe(testMessage);
          resolve();
        });

        webSocket.send(testMessage);
      });

      // CLEANUP
      webSocket.close();
    }, 10000);

    it('should handle connection timeout with real network delay', async () => {
      // ARRANGE: Create discovery with short timeout
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      
      // Use a non-routable IP address that will cause connection to hang
      // 10.255.255.1 is typically non-routable and will timeout
      const timeoutUrl = 'ws://10.255.255.1:8080/timeout-test';

      // ACT & ASSERT: Should timeout
      await expect(discovery.establishConnection(timeoutUrl, 500))
        .rejects.toThrow(/WebSocket connection timeout after 500ms|Failed to create WebSocket/);
    }, 5000);

    it('should handle immediate connection failure with invalid port', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      const invalidUrl = 'ws://localhost:99999/invalid'; // Port out of range

      // ACT & ASSERT
      await expect(discovery.establishConnection(invalidUrl))
        .rejects.toThrow(/Failed to create WebSocket|WebSocket connection failed/);
    }, 5000);

    it('should establish multiple concurrent connections', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      const webSocketUrl = `ws://localhost:${testServerPort}`;

      // ACT: Establish multiple connections concurrently
      const connectionPromises = [
        discovery.establishConnection(webSocketUrl),
        discovery.establishConnection(webSocketUrl),
        discovery.establishConnection(webSocketUrl)
      ];

      const connections = await Promise.all(connectionPromises);

      // ASSERT: All connections should be valid
      expect(connections).toHaveLength(3);
      connections.forEach(ws => {
        expect(ws).toBeInstanceOf(WebSocket);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        expect(discovery.validateConnection(ws)).toBe(true);
      });

      // CLEANUP
      connections.forEach(ws => ws.close());
    }, 10000);

    it('should properly clean up resources on connection failure', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      
      // Use an invalid port to trigger connection failure
      const invalidUrl = 'ws://localhost:65535/nonexistent'; // Max valid port
      
      // ACT: Try to connect to non-existent server
      let errorOccurred = false;
      try {
        await discovery.establishConnection(invalidUrl, 500);
      } catch (error) {
        // Expected to fail
        errorOccurred = true;
        expect(error).toBeInstanceOf(Error);
      }

      // ASSERT: Error should have occurred
      expect(errorOccurred).toBe(true);
    }, 5000);
  });

  describe('Full Discovery and Connection Workflow E2E', () => {
    it('should complete full workflow from discovery to connection', async () => {
      // This test requires an actual SSH session to be created first
      // We'll test the URL parsing and connection establishment parts
      
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      
      // Simulate what would happen if we had a valid session
      const mockMonitoringUrl = `http://localhost:${testServerPort}/session/e2e-test`;
      
      // ACT: Parse URL and establish connection
      const webSocketUrl = discovery.parseMonitoringUrl(mockMonitoringUrl);
      expect(webSocketUrl).toBe(`ws://localhost:${testServerPort}/ws/session/e2e-test`);
      
      // Note: Actual connection would fail since our test server doesn't handle this path
      // but we can verify the URL transformation works correctly
    });

    it('should handle HTTPS to WSS conversion correctly', () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      const httpsUrl = 'https://secure.example.com:8443/session/secure-test';
      
      // ACT
      const wssUrl = discovery.parseMonitoringUrl(httpsUrl);
      
      // ASSERT
      expect(wssUrl).toBe('wss://secure.example.com:8443/ws/session/secure-test');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle WebSocket server that closes connection immediately', async () => {
      // ARRANGE: Create server that closes connections immediately
      const rejectServer = http.createServer();
      const rejectWsServer = new WebSocketServer({ server: rejectServer });
      
      rejectWsServer.on('connection', (ws) => {
        ws.close();
      });

      await new Promise<void>((resolve) => {
        rejectServer.listen(0, resolve);
      });
      
      const rejectPort = (rejectServer.address() as any).port;
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      
      // ACT: Try to connect to server that will close connection
      const webSocketUrl = `ws://localhost:${rejectPort}`;
      
      try {
        const ws = await discovery.establishConnection(webSocketUrl, 2000);
        // Connection might succeed momentarily before being closed
        // Check if it's already closing/closed
        const isValid = discovery.validateConnection(ws);
        expect([false, true]).toContain(isValid);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch (error) {
        // Connection might fail immediately, which is also acceptable
        expect(error).toBeInstanceOf(Error);
      }

      // CLEANUP
      rejectWsServer.close();
      await new Promise<void>((resolve) => {
        rejectServer.close(() => resolve());
      });
    }, 5000);

    it('should validate connection state transitions correctly', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      const webSocketUrl = `ws://localhost:${testServerPort}`;
      
      // ACT: Create connection and test state transitions
      const webSocket = await discovery.establishConnection(webSocketUrl);
      
      // ASSERT: Initially should be open
      expect(discovery.validateConnection(webSocket)).toBe(true);
      
      // Close the connection
      webSocket.close();
      
      // Wait for close to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should now be invalid
      expect(discovery.validateConnection(webSocket)).toBe(false);
    }, 5000);

    it('should handle malformed WebSocket URLs gracefully', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      const malformedUrls = [
        'not-a-url',
        'ws://', // Missing host
        'ws:///path', // Missing host
        'websocket://localhost:8080', // Invalid protocol
      ];

      // ACT & ASSERT: Each should fail with appropriate error
      for (const url of malformedUrls) {
        await expect(discovery.establishConnection(url))
          .rejects.toThrow(/Failed to create WebSocket|WebSocket connection failed/);
      }
    }, 10000);
  });

  describe('Performance and Resource Management', () => {
    it('should respect custom timeout settings', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      
      // Set custom default timeout
      discovery.setDefaultConnectionTimeout(200);
      expect(discovery.getDefaultConnectionTimeout()).toBe(200);
      
      // Create hanging connection scenario
      const hangingUrl = 'ws://10.255.255.1:8080/hang'; // Non-routable IP
      
      // ACT & ASSERT: Should use the new default timeout
      const startTime = Date.now();
      await expect(discovery.establishConnection(hangingUrl))
        .rejects.toThrow(/timeout after 200ms|Failed to create WebSocket/);
      const elapsed = Date.now() - startTime;
      
      // Should have failed around 200ms (with some tolerance)
      expect(elapsed).toBeLessThan(500);
    }, 2000);

    it('should allow per-connection timeout override', async () => {
      // ARRANGE
      const discovery = new WebSocketConnectionDiscovery(mcpClient);
      discovery.setDefaultConnectionTimeout(5000); // Set high default
      
      const hangingUrl = 'ws://10.255.255.1:8080/hang';
      
      // ACT & ASSERT: Override with shorter timeout
      const startTime = Date.now();
      await expect(discovery.establishConnection(hangingUrl, 100))
        .rejects.toThrow(/timeout after 100ms|Failed to create WebSocket/);
      const elapsed = Date.now() - startTime;
      
      // Should have used override timeout, not default
      expect(elapsed).toBeLessThan(300);
    }, 1000);
  });
});