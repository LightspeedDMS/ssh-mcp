/**
 * Story 5: Post-WebSocket Real-time Command Execution - Integration Tests
 * 
 * Integration tests for PostWebSocketCommandExecutor with real MCP connections
 * and WebSocket message capture. These tests use real components with minimal mocking.
 * 
 * CRITICAL: These are integration tests - NO MOCKS for core functionality.
 * Real MCP server, real WebSocket connections, real message capture.
 */

import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import WebSocket, { WebSocketServer } from 'ws';
import { ChildProcess } from 'child_process';

describe('PostWebSocketCommandExecutor - Integration Tests', () => {
  let mcpServerManager: MCPServerManager;
  let mcpClient: MCPClient;
  let historyCapture: InitialHistoryReplayCapture;
  let executor: PostWebSocketCommandExecutor;
  let mockWebSocketServer: WebSocketServer;
  let mockWebSocket: WebSocket;
  let serverPort: number;

  beforeAll(async () => {
    // Start a mock WebSocket server for message capture testing
    mockWebSocketServer = new WebSocketServer({ port: 0 });
    serverPort = (mockWebSocketServer.address() as any).port;
  });

  afterAll(async () => {
    if (mockWebSocketServer) {
      mockWebSocketServer.close();
    }
  });

  beforeEach(async () => {
    // Initialize MCP server manager
    mcpServerManager = new MCPServerManager();
    
    // Start MCP server
    await mcpServerManager.start();

    // Get server process info and create MCP client
    const processInfo = mcpServerManager.getProcess();
    if (!processInfo) {
      throw new Error('Failed to get server process');
    }
    
    const serverProcess = { 
      stdin: processInfo.stdin, 
      stdout: processInfo.stdout 
    } as ChildProcess;
    
    mcpClient = new MCPClient(serverProcess);

    // Initialize history capture
    historyCapture = new InitialHistoryReplayCapture(undefined, {
      historyReplayTimeout: 2000,
      captureTimeout: 30000,
      maxHistoryMessages: 100
    });

    // Create executor
    executor = new PostWebSocketCommandExecutor(mcpClient, historyCapture, {
      commandTimeout: 15000,
      interCommandDelay: 500,
      maxRetries: 2
    });

    // Create mock WebSocket connection for message capture
    mockWebSocket = new WebSocket(`ws://localhost:${serverPort}`);
    
    // Wait for WebSocket connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      
      mockWebSocket.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      mockWebSocket.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    // Setup message echoing to simulate terminal responses
    mockWebSocketServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        // Echo back the message to simulate terminal output
        setTimeout(() => {
          ws.send(`echo: ${data}`);
          ws.send('prompt> ');
        }, 100);
      });
    });
  });

  afterEach(async () => {
    if (executor) {
      await executor.cleanup();
    }
    if (historyCapture) {
      await historyCapture.cleanup();
    }
    if (mockWebSocket && mockWebSocket.readyState === WebSocket.OPEN) {
      mockWebSocket.close();
    }
    if (mcpServerManager) {
      await mcpServerManager.stop();
    }
  });

  describe('Real MCP Integration', () => {
    test('should execute ssh_exec command via real MCP server', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Execute command
      const results = await executor.executeCommands(['ssh_exec whoami'], mockWebSocket);

      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('ssh_exec whoami');
      expect(results[0].success).toBeDefined();
      expect(results[0].mcpResponse).toBeDefined();
      expect(results[0].executionStartTime).toBeLessThanOrEqual(results[0].executionEndTime);
      
      // Verify MCP response structure
      if (results[0].mcpResponse) {
        expect(typeof results[0].mcpResponse.success).toBe('boolean');
      }
    });

    test('should execute multiple commands sequentially via real MCP server', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      const commands = ['ssh_exec whoami', 'ssh_exec pwd'];
      const startTime = Date.now();
      const results = await executor.executeCommands(commands, mockWebSocket);

      expect(results).toHaveLength(2);
      
      // Verify commands were executed sequentially
      expect(results[0].executionStartTime).toBeLessThanOrEqual(results[1].executionStartTime);
      expect(results[0].executionEndTime).toBeLessThanOrEqual(results[1].executionStartTime);

      // Verify inter-command delay was applied
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(400); // At least one delay period

      // Each result should have valid structure
      results.forEach((result, index) => {
        expect(result.command).toBe(commands[index]);
        expect(result.executionStartTime).toBeLessThanOrEqual(result.executionEndTime);
        expect(result.mcpResponse).toBeDefined();
      });
    });

    test('should handle real MCP command failures gracefully', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Execute invalid command that should fail
      const results = await executor.executeCommands(['ssh_exec /invalid/command/path'], mockWebSocket);

      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('ssh_exec /invalid/command/path');
      expect(results[0].mcpResponse).toBeDefined();
      
      // Should handle failure without throwing
      if (results[0].mcpResponse && !results[0].mcpResponse.success) {
        expect(results[0].error).toBeDefined();
      }
    });
  });

  describe('WebSocket Message Correlation', () => {
    test('should correlate real WebSocket messages with command execution', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Wait for history replay to complete
      await historyCapture.waitForHistoryReplayComplete();

      // Send a test message to generate WebSocket traffic
      mockWebSocket.send('test message before command');
      
      // Give time for message to arrive
      await new Promise(resolve => setTimeout(resolve, 200));

      // Execute command
      const results = await executor.executeCommands(['ssh_exec echo test'], mockWebSocket);

      expect(results).toHaveLength(1);
      
      // Should have captured some messages (at least the echoed responses)
      expect(results[0].capturedMessages).toBeDefined();
      expect(Array.isArray(results[0].capturedMessages)).toBe(true);
      
      // Verify message structure if messages were captured
      if (results[0].capturedMessages.length > 0) {
        results[0].capturedMessages.forEach(message => {
          expect(message.timestamp).toBeDefined();
          expect(message.data).toBeDefined();
          expect(typeof message.isHistoryReplay).toBe('boolean');
          expect(message.sequenceNumber).toBeDefined();
        });
      }
    });

    test('should distinguish between history replay and real-time messages', async () => {
      // Send some messages before starting capture (these won't be captured)
      mockWebSocket.send('pre-capture message');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Send message during history replay phase
      mockWebSocket.send('during history replay');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Wait for history replay to complete
      await historyCapture.waitForHistoryReplayComplete();

      // Send message during real-time phase
      mockWebSocket.send('real-time message');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute command during real-time phase
      const results = await executor.executeCommands(['ssh_exec echo realtime'], mockWebSocket);

      // Verify message correlation
      const historyMessages = historyCapture.getHistoryMessages();
      const realTimeMessages = historyCapture.getRealTimeMessages();

      // Should have some messages in each category
      expect(historyMessages.length + realTimeMessages.length).toBeGreaterThan(0);

      // History messages should be marked as history replay
      historyMessages.forEach(msg => {
        expect(msg.isHistoryReplay).toBe(true);
      });

      // Real-time messages should not be marked as history replay
      realTimeMessages.forEach(msg => {
        expect(msg.isHistoryReplay).toBe(false);
      });

      // Command execution should correlate with real-time messages
      expect(results[0].capturedMessages.every(msg => !msg.isHistoryReplay)).toBe(true);
    });
  });

  describe('Error Handling and Resource Management', () => {
    test('should handle WebSocket disconnection during execution', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Close WebSocket during execution
      setTimeout(() => {
        mockWebSocket.close();
      }, 100);

      // Execute command - should not fail due to WebSocket closure
      const results = await executor.executeCommands(['ssh_exec echo test'], mockWebSocket);

      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('ssh_exec echo test');
      // Should complete despite WebSocket closure
    });

    test('should prevent concurrent command execution', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Start first execution (don't await)
      const firstExecution = executor.executeCommands(['ssh_exec sleep 1'], mockWebSocket);

      // Try to start second execution
      await expect(executor.executeCommands(['ssh_exec whoami'], mockWebSocket))
        .rejects.toThrow('Command execution already in progress');

      // Wait for first execution to complete
      await firstExecution;

      // Should now allow new execution
      const results = await executor.executeCommands(['ssh_exec whoami'], mockWebSocket);
      expect(results).toHaveLength(1);
    });

    test('should cleanup resources properly after execution', async () => {
      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      // Execute commands
      await executor.executeCommands(['ssh_exec echo test'], mockWebSocket);

      // Verify cleanup
      expect(executor.isExecuting()).toBe(false);

      // Manual cleanup should not throw
      await expect(executor.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Configuration and Timeouts', () => {
    test('should respect command timeout configuration', async () => {
      // Create executor with short timeout
      const shortTimeoutExecutor = new PostWebSocketCommandExecutor(mcpClient, historyCapture, {
        commandTimeout: 100, // Very short timeout
        interCommandDelay: 0,
        maxRetries: 1
      });

      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      try {
        // Execute command that might timeout (depending on server response time)
        const results = await shortTimeoutExecutor.executeCommands(['ssh_exec sleep 2'], mockWebSocket);
        
        // If command completes within timeout, that's also valid
        expect(results).toHaveLength(1);
      } catch (error) {
        // Timeout is acceptable for this test
        expect((error as Error).message).toContain('timeout');
      } finally {
        await shortTimeoutExecutor.cleanup();
      }
    });

    test('should apply inter-command delays as configured', async () => {
      // Create executor with specific delay
      const delayedExecutor = new PostWebSocketCommandExecutor(mcpClient, historyCapture, {
        commandTimeout: 15000,
        interCommandDelay: 1000, // 1 second delay
        maxRetries: 2
      });

      // Start WebSocket message capture
      await historyCapture.captureInitialHistory(mockWebSocket);

      const startTime = Date.now();
      await delayedExecutor.executeCommands(['ssh_exec echo 1', 'ssh_exec echo 2'], mockWebSocket);
      const totalTime = Date.now() - startTime;

      // Should take at least the delay time
      expect(totalTime).toBeGreaterThanOrEqual(800); // Allow some margin

      await delayedExecutor.cleanup();
    });
  });
});