/**
 * Story 5: Post-WebSocket Real-time Command Execution - Unit Tests
 * 
 * Comprehensive unit tests for PostWebSocketCommandExecutor class using TDD approach.
 * These tests will initially FAIL and drive the implementation.
 * 
 * CRITICAL: These are unit tests - they test the class logic without external dependencies.
 * For integration tests with real MCP and WebSocket, see separate integration test file.
 */

import { PostWebSocketCommandExecutor, PostWebSocketCommandExecutorConfig } from './post-websocket-command-executor';
import { MCPClient, MCPToolResponse } from './mcp-client';
import { InitialHistoryReplayCapture, CapturedMessage } from './initial-history-replay-capture';
import WebSocket from 'ws';

describe('PostWebSocketCommandExecutor - Unit Tests', () => {
  let executor: PostWebSocketCommandExecutor;
  let mockMCPClient: jest.Mocked<MCPClient>;
  let mockHistoryCapture: jest.Mocked<InitialHistoryReplayCapture>;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    // Create mock MCPClient
    mockMCPClient = {
      callTool: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn()
    } as unknown as jest.Mocked<MCPClient>;

    // Create mock InitialHistoryReplayCapture
    mockHistoryCapture = {
      captureInitialHistory: jest.fn(),
      waitForHistoryReplayComplete: jest.fn(),
      distinguishMessageTypes: jest.fn(),
      getHistoryMessages: jest.fn(),
      getRealTimeMessages: jest.fn(),
      isCapturing: jest.fn(),
      getConfig: jest.fn(),
      getSequenceNumber: jest.fn(),
      cleanup: jest.fn()
    } as unknown as jest.Mocked<InitialHistoryReplayCapture>;

    // Create mock WebSocket
    mockWebSocket = {
      on: jest.fn(),
      off: jest.fn(),
      send: jest.fn(),
      close: jest.fn()
    } as any as jest.Mocked<WebSocket>;
  });

  afterEach(async () => {
    if (executor) {
      await executor.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create executor with default configuration when no config provided', () => {
      executor = new PostWebSocketCommandExecutor();
      
      const config = executor.getConfig();
      expect(config.commandTimeout).toBe(30000);
      expect(config.interCommandDelay).toBe(1000);
      expect(config.maxRetries).toBe(3);
    });

    test('should create executor with custom configuration', () => {
      const customConfig: PostWebSocketCommandExecutorConfig = {
        commandTimeout: 15000,
        interCommandDelay: 500,
        maxRetries: 5
      };

      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture, customConfig);
      
      const config = executor.getConfig();
      expect(config.commandTimeout).toBe(15000);
      expect(config.interCommandDelay).toBe(500);
      expect(config.maxRetries).toBe(5);
    });

    test('should accept MCPClient and InitialHistoryReplayCapture dependencies', () => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);
      expect(executor).toBeDefined();
    });
  });

  describe('executeCommands', () => {
    beforeEach(() => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);
    });

    test('should throw error when execution already in progress', async () => {
      // Setup mock to delay first command
      mockMCPClient.callTool.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      // Start first execution (won't await)
      const firstExecution = executor.executeCommands(['ssh_exec whoami'], mockWebSocket);

      // Try to start second execution immediately
      await expect(executor.executeCommands(['ssh_exec ls'], mockWebSocket))
        .rejects.toThrow('Command execution already in progress');

      // Clean up first execution
      await firstExecution;
    });

    test('should execute single command successfully', async () => {
      const mockResponse: MCPToolResponse = {
        success: true,
        result: { output: 'user1' }
      };

      mockMCPClient.callTool.mockResolvedValue(mockResponse);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      const results = await executor.executeCommands(['ssh_exec whoami'], mockWebSocket);

      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('ssh_exec whoami');
      expect(results[0].success).toBe(true);
      expect(results[0].mcpResponse).toEqual(mockResponse);
      expect(results[0].error).toBeUndefined();
      expect(results[0].executionStartTime).toBeLessThanOrEqual(results[0].executionEndTime);
    });

    test('should execute multiple commands sequentially with proper delay', async () => {
      const commands = ['ssh_exec whoami', 'ssh_exec pwd', 'ssh_exec ls'];
      let callOrder: number[] = [];
      
      mockMCPClient.callTool.mockImplementation(async (_toolName: string, args: Record<string, unknown>) => {
        callOrder.push(Date.now());
        return { success: true, result: { output: `result for ${args.command}` } };
      });
      
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      const startTime = Date.now();
      const results = await executor.executeCommands(commands, mockWebSocket);

      // Verify all commands executed
      expect(results).toHaveLength(3);
      expect(mockMCPClient.callTool).toHaveBeenCalledTimes(3);

      // Verify commands were called in correct order
      expect(mockMCPClient.callTool).toHaveBeenNthCalledWith(1, 'ssh_exec', { command: 'whoami' });
      expect(mockMCPClient.callTool).toHaveBeenNthCalledWith(2, 'ssh_exec', { command: 'pwd' });
      expect(mockMCPClient.callTool).toHaveBeenNthCalledWith(3, 'ssh_exec', { command: 'ls' });

      // Verify inter-command delays were applied (should take at least 2 seconds for delays)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThanOrEqual(1500); // Allow some margin
    });

    test('should handle command execution failures gracefully', async () => {
      const mockError = new Error('SSH connection failed');
      
      mockMCPClient.callTool.mockRejectedValue(mockError);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      const results = await executor.executeCommands(['ssh_exec invalid'], mockWebSocket);

      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('ssh_exec invalid');
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('SSH connection failed');
      expect(results[0].mcpResponse).toBeUndefined();
    });

    test('should handle MCP tool response with error', async () => {
      const mockResponse: MCPToolResponse = {
        success: false,
        error: 'Command execution failed'
      };

      mockMCPClient.callTool.mockResolvedValue(mockResponse);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      const results = await executor.executeCommands(['ssh_exec invalid'], mockWebSocket);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Command execution failed');
      expect(results[0].mcpResponse).toEqual(mockResponse);
    });

    test('should throw error when MCPClient not provided', async () => {
      executor = new PostWebSocketCommandExecutor(); // No MCPClient

      await expect(executor.executeCommands(['ssh_exec whoami'], mockWebSocket))
        .rejects.toThrow('MCPClient not provided');
    });
  });

  describe('WebSocket Message Correlation', () => {
    beforeEach(() => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);
    });

    test('should correlate WebSocket messages with command execution', async () => {
      const mockMessages: CapturedMessage[] = [
        {
          timestamp: Date.now(),
          data: 'user1\\r\\n',
          isHistoryReplay: false,
          sequenceNumber: 1
        },
        {
          timestamp: Date.now() + 100,
          data: 'prompt> ',
          isHistoryReplay: false,
          sequenceNumber: 2
        }
      ];

      let messageCallCount = 0;
      mockHistoryCapture.getRealTimeMessages.mockImplementation(() => {
        messageCallCount++;
        if (messageCallCount === 1) return []; // Before command
        return mockMessages; // After command
      });
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      mockMCPClient.callTool.mockResolvedValue({ success: true });

      const results = await executor.executeCommands(['ssh_exec whoami'], mockWebSocket);

      expect(results[0].capturedMessages).toEqual(mockMessages);
      expect(mockHistoryCapture.getRealTimeMessages).toHaveBeenCalledTimes(2);
    });

    test('should handle mixed history and real-time messages', async () => {
      const historyMessages: CapturedMessage[] = [
        { timestamp: Date.now() - 1000, data: 'old data', isHistoryReplay: true, sequenceNumber: 1 }
      ];
      const realTimeMessages: CapturedMessage[] = [
        { timestamp: Date.now(), data: 'new data', isHistoryReplay: false, sequenceNumber: 2 }
      ];

      let messageCallCount = 0;
      mockHistoryCapture.getHistoryMessages.mockReturnValue(historyMessages);
      mockHistoryCapture.getRealTimeMessages.mockImplementation(() => {
        messageCallCount++;
        if (messageCallCount === 1) return []; // Before command
        return realTimeMessages; // After command
      });

      mockMCPClient.callTool.mockResolvedValue({ success: true });

      const results = await executor.executeCommands(['ssh_exec test'], mockWebSocket);

      // Should capture only messages after command execution
      expect(results[0].capturedMessages).toEqual(realTimeMessages);
    });
  });

  describe('Command Parsing', () => {
    beforeEach(() => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);
    });

    test('should parse ssh_exec commands correctly', async () => {
      mockMCPClient.callTool.mockResolvedValue({ success: true });
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      await executor.executeCommands(['ssh_exec whoami'], mockWebSocket);

      expect(mockMCPClient.callTool).toHaveBeenCalledWith('ssh_exec', { command: 'whoami' });
    });

    test('should parse ssh_exec commands with multiple arguments', async () => {
      mockMCPClient.callTool.mockResolvedValue({ success: true });
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      await executor.executeCommands(['ssh_exec ls -la /home'], mockWebSocket);

      expect(mockMCPClient.callTool).toHaveBeenCalledWith('ssh_exec', { command: 'ls -la /home' });
    });

    test('should handle empty command gracefully', async () => {
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      const results = await executor.executeCommands([''], mockWebSocket);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Empty command');
    });

    test('should parse non-ssh_exec commands with numbered arguments', async () => {
      mockMCPClient.callTool.mockResolvedValue({ success: true });
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      await executor.executeCommands(['other_tool arg1 arg2 arg3'], mockWebSocket);

      expect(mockMCPClient.callTool).toHaveBeenCalledWith('other_tool', {
        arg1: 'arg1',
        arg2: 'arg2',
        arg3: 'arg3'
      });
    });
  });

  describe('State Management', () => {
    test('should track execution state correctly', () => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);
      
      expect(executor.isExecuting()).toBe(false);
    });

    test('should set executing state during command execution', async () => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);

      let executingDuringCommand = false;
      mockMCPClient.callTool.mockImplementation(async () => {
        executingDuringCommand = executor.isExecuting();
        return { success: true };
      });
      
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);

      expect(executor.isExecuting()).toBe(false);
      
      await executor.executeCommands(['ssh_exec test'], mockWebSocket);
      
      expect(executingDuringCommand).toBe(true);
      expect(executor.isExecuting()).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      executor = new PostWebSocketCommandExecutor(mockMCPClient, mockHistoryCapture);

      await executor.cleanup();

      expect(executor.isExecuting()).toBe(false);
    });
  });
});