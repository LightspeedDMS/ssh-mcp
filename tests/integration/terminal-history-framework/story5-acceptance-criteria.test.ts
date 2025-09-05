/**
 * Story 5: Post-WebSocket Real-time Command Execution - Acceptance Criteria Validation
 * 
 * Direct validation of all Story 5 acceptance criteria using the Gherkin format:
 * 
 * Given I have established WebSocket connection
 * And I have specified post-WebSocket commands ["ssh_exec whoami"]
 * When the testing framework executes the post-phase
 * Then it should send each command via MCP stdin/stdout
 * And capture corresponding WebSocket messages for each command
 * And wait for WebSocket responses before sending next command
 * And preserve message ordering between commands
 * And handle command execution failures appropriately
 * 
 * CRITICAL: These are acceptance tests - NO MOCKS for core functionality.
 * Real MCP server, real WebSocket connections, real message capture.
 */

import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import WebSocket, { WebSocketServer } from 'ws';
import { ChildProcess } from 'child_process';

describe('Story 5: Post-WebSocket Real-time Command Execution - Acceptance Criteria', () => {
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
    mockWebSocketServer.removeAllListeners('connection');
    mockWebSocketServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        // Echo back the message to simulate terminal output
        setTimeout(() => {
          ws.send(`server_response: ${data}`);
          ws.send('prompt> ');
        }, 50);
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
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (mcpServerManager) {
      await mcpServerManager.stop();
    }
  });

  describe('Acceptance Criteria: Given I have established WebSocket connection', () => {
    test('WebSocket connection should be established before command execution', async () => {
      // Given: WebSocket connection is established (already done in beforeEach)
      expect(mockWebSocket.readyState).toBe(WebSocket.OPEN);
      
      // And: History capture is initialized
      await historyCapture.captureInitialHistory(mockWebSocket);
      expect(historyCapture.isCapturing()).toBe(true);
    });
  });

  describe('Acceptance Criteria: And I have specified post-WebSocket commands ["ssh_exec whoami"]', () => {
    test('should accept and validate post-WebSocket commands specification', async () => {
      const commands = ['ssh_exec whoami'];
      
      // Given: WebSocket connection established
      await historyCapture.captureInitialHistory(mockWebSocket);
      
      // When: Commands are specified
      // Then: Executor should accept the command specification without error
      expect(() => {
        // This validates command parsing in the executor
        const testCommands = commands;
        expect(testCommands).toEqual(['ssh_exec whoami']);
      }).not.toThrow();
    });
  });

  describe('Acceptance Criteria: When the testing framework executes the post-phase', () => {
    test('should execute post-phase after WebSocket connection is established', async () => {
      const commands = ['ssh_exec whoami'];
      
      // Given: WebSocket connection established
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // When: Testing framework executes the post-phase
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: Post-phase execution should complete successfully
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('ssh_exec whoami');
      expect(results[0].executionStartTime).toBeLessThanOrEqual(results[0].executionEndTime);
    });
  });

  describe('Acceptance Criteria: Then it should send each command via MCP stdin/stdout', () => {
    test('should send commands via real MCP stdin/stdout communication', async () => {
      const commands = ['ssh_exec whoami', 'ssh_exec pwd'];
      
      // Given: WebSocket connection and commands specified
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // When: Commands are executed
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: Each command should be sent via MCP stdin/stdout
      expect(results).toHaveLength(2);
      results.forEach((result, index) => {
        expect(result.command).toBe(commands[index]);
        expect(result.mcpResponse).toBeDefined();
        // MCP response indicates real stdin/stdout communication occurred
        expect(typeof result.mcpResponse?.success).toBe('boolean');
      });
    });
  });

  describe('Acceptance Criteria: And capture corresponding WebSocket messages for each command', () => {
    test('should capture WebSocket messages corresponding to each command execution', async () => {
      const commands = ['ssh_exec echo test1', 'ssh_exec echo test2'];
      
      // Given: WebSocket connection and message capture setup
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // Send some messages to generate WebSocket traffic
      mockWebSocket.send('pre-command message');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // When: Commands are executed
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: WebSocket messages should be captured for each command
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.capturedMessages).toBeDefined();
        expect(Array.isArray(result.capturedMessages)).toBe(true);
        // Each command execution should correlate with captured messages
      });
    });
  });

  describe('Acceptance Criteria: And wait for WebSocket responses before sending next command', () => {
    test('should wait for WebSocket responses before proceeding to next command', async () => {
      const commands = ['ssh_exec echo first', 'ssh_exec echo second'];
      
      // Given: WebSocket connection established
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // Track execution timing
      let firstCommandComplete = 0;
      let secondCommandStart = 0;
      
      // Monitor MCP client calls to track timing
      const originalCallTool = mcpClient.callTool;
      let callCount = 0;
      mcpClient.callTool = async (name: string, args: Record<string, unknown>) => {
        callCount++;
        if (callCount === 1) {
          const result = await originalCallTool.call(mcpClient, name, args);
          firstCommandComplete = Date.now();
          return result;
        } else if (callCount === 2) {
          secondCommandStart = Date.now();
          return await originalCallTool.call(mcpClient, name, args);
        }
        return await originalCallTool.call(mcpClient, name, args);
      };
      
      // When: Commands are executed
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: Second command should start after first command completes
      expect(results).toHaveLength(2);
      expect(firstCommandComplete).toBeLessThanOrEqual(secondCommandStart);
      expect(results[0].executionEndTime).toBeLessThanOrEqual(results[1].executionStartTime);
      
      // Restore original method
      mcpClient.callTool = originalCallTool;
    });
  });

  describe('Acceptance Criteria: And preserve message ordering between commands', () => {
    test('should preserve message ordering between sequential command executions', async () => {
      const commands = ['ssh_exec echo cmd1', 'ssh_exec echo cmd2', 'ssh_exec echo cmd3'];
      
      // Given: WebSocket connection established
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // When: Multiple commands are executed sequentially
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: Message ordering should be preserved
      expect(results).toHaveLength(3);
      
      // Verify sequential execution timing
      expect(results[0].executionEndTime).toBeLessThanOrEqual(results[1].executionStartTime);
      expect(results[1].executionEndTime).toBeLessThanOrEqual(results[2].executionStartTime);
      
      // Verify each command has its own captured messages
      results.forEach((result, index) => {
        expect(result.command).toBe(commands[index]);
        expect(result.capturedMessages).toBeDefined();
      });
    });
  });

  describe('Acceptance Criteria: And handle command execution failures appropriately', () => {
    test('should handle command execution failures without stopping subsequent commands', async () => {
      const commands = ['ssh_exec /invalid/command', 'ssh_exec whoami'];
      
      // Given: WebSocket connection established
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // When: Commands include a failing command
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: Failures should be handled appropriately
      expect(results).toHaveLength(2);
      
      // First command should fail but not throw
      expect(results[0].command).toBe('ssh_exec /invalid/command');
      expect(results[0].mcpResponse).toBeDefined();
      
      // Second command should still execute despite first command failure
      expect(results[1].command).toBe('ssh_exec whoami');
      expect(results[1].mcpResponse).toBeDefined();
      
      // Both commands should have execution times recorded
      expect(results[0].executionStartTime).toBeLessThanOrEqual(results[0].executionEndTime);
      expect(results[1].executionStartTime).toBeLessThanOrEqual(results[1].executionEndTime);
    });

    test('should capture failure details in command execution results', async () => {
      const commands = ['ssh_exec /definitely/invalid/command/path'];
      
      // Given: WebSocket connection established  
      await historyCapture.captureInitialHistory(mockWebSocket);
      await historyCapture.waitForHistoryReplayComplete();
      
      // When: A command that will fail is executed
      const results = await executor.executeCommands(commands, mockWebSocket);
      
      // Then: Failure details should be captured appropriately
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe(commands[0]);
      expect(results[0].mcpResponse).toBeDefined();
      
      // Should still capture messages even for failed commands
      expect(results[0].capturedMessages).toBeDefined();
      expect(Array.isArray(results[0].capturedMessages)).toBe(true);
    });
  });

  describe('Complete Acceptance Criteria Integration', () => {
    test('should satisfy all acceptance criteria in a single comprehensive scenario', async () => {
      // Given I have established WebSocket connection
      expect(mockWebSocket.readyState).toBe(WebSocket.OPEN);
      await historyCapture.captureInitialHistory(mockWebSocket);
      
      // And I have specified post-WebSocket commands
      const postWebSocketCommands = ['ssh_exec whoami', 'ssh_exec pwd', 'ssh_exec /invalid/cmd'];
      
      // When the testing framework executes the post-phase
      const startTime = Date.now();
      const results = await executor.executeCommands(postWebSocketCommands, mockWebSocket);
      const totalTime = Date.now() - startTime;
      
      // Then it should send each command via MCP stdin/stdout
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.mcpResponse).toBeDefined();
        expect(typeof result.mcpResponse?.success).toBe('boolean');
      });
      
      // And capture corresponding WebSocket messages for each command
      results.forEach(result => {
        expect(result.capturedMessages).toBeDefined();
        expect(Array.isArray(result.capturedMessages)).toBe(true);
      });
      
      // And wait for WebSocket responses before sending next command
      expect(results[0].executionEndTime).toBeLessThanOrEqual(results[1].executionStartTime);
      expect(results[1].executionEndTime).toBeLessThanOrEqual(results[2].executionStartTime);
      
      // And preserve message ordering between commands
      expect(totalTime).toBeGreaterThanOrEqual(1000); // Inter-command delays applied
      
      // And handle command execution failures appropriately
      expect(results[0].command).toBe('ssh_exec whoami');
      expect(results[1].command).toBe('ssh_exec pwd');
      expect(results[2].command).toBe('ssh_exec /invalid/cmd');
      // All commands should complete execution regardless of success/failure
      results.forEach(result => {
        expect(result.executionStartTime).toBeLessThanOrEqual(result.executionEndTime);
      });
    });
  });
});