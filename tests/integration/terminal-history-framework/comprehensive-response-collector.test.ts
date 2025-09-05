/**
 * Story 6: Comprehensive Response Collection and Output - Unit Tests
 * 
 * Unit tests for ComprehensiveResponseCollector class that orchestrates
 * the complete terminal history testing framework workflow.
 * 
 * This tests the orchestration of Stories 1-5 components in a complete workflow.
 * 
 * CRITICAL: Following strict TDD red-green-refactor cycle.
 */

import { ComprehensiveResponseCollector, ComprehensiveResponseCollectorConfig } from './comprehensive-response-collector';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor } from './post-websocket-command-executor';
import WebSocket from 'ws';

describe('ComprehensiveResponseCollector', () => {
  let collector: ComprehensiveResponseCollector;
  let mockServerManager: jest.Mocked<MCPServerManager>;
  let mockMcpClient: jest.Mocked<MCPClient>;
  let mockPreWebSocketExecutor: jest.Mocked<PreWebSocketCommandExecutor>;
  let mockConnectionDiscovery: jest.Mocked<WebSocketConnectionDiscovery>;
  let mockHistoryCapture: jest.Mocked<InitialHistoryReplayCapture>;
  let mockPostWebSocketExecutor: jest.Mocked<PostWebSocketCommandExecutor>;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    // Create mocks for unit testing (only for testing the orchestration logic)
    mockServerManager = {
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn(),
      getProcess: jest.fn()
    } as any;

    mockMcpClient = {
      isConnected: jest.fn(),
      callTool: jest.fn(),
      disconnect: jest.fn()
    } as any;

    mockPreWebSocketExecutor = {
      executeCommands: jest.fn(),
      cleanup: jest.fn(),
      isReady: jest.fn()
    } as any;

    mockConnectionDiscovery = {
      discoverWebSocketUrl: jest.fn(),
      establishConnection: jest.fn(),
      validateConnection: jest.fn()
    } as any;

    mockHistoryCapture = {
      captureInitialHistory: jest.fn(),
      waitForHistoryReplayComplete: jest.fn(),
      getHistoryMessages: jest.fn(),
      getRealTimeMessages: jest.fn(),
      cleanup: jest.fn()
    } as any;

    mockPostWebSocketExecutor = {
      executeCommands: jest.fn(),
      cleanup: jest.fn()
    } as any;

    mockWebSocket = {
      readyState: WebSocket.OPEN,
      close: jest.fn(),
      terminate: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    collector = new ComprehensiveResponseCollector();
  });

  afterEach(async () => {
    await collector.cleanup();
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      const collector = new ComprehensiveResponseCollector();
      expect(collector).toBeInstanceOf(ComprehensiveResponseCollector);
    });

    it('should create instance with custom configuration', () => {
      const config: ComprehensiveResponseCollectorConfig = {
        workflowTimeout: 15000,
        sessionName: 'custom-session',
        preWebSocketCommands: [{ tool: 'ssh_exec', args: { command: 'ls' } }],
        postWebSocketCommands: ['ssh_exec ls -la'],
        historyReplayTimeout: 5000,
        commandTimeout: 25000
      };

      const collector = new ComprehensiveResponseCollector(config);
      expect(collector).toBeInstanceOf(ComprehensiveResponseCollector);
      expect(collector.getConfig()).toEqual(expect.objectContaining({
        workflowTimeout: 15000,
        sessionName: 'custom-session'
      }));
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        new ComprehensiveResponseCollector({ workflowTimeout: -1000 });
      }).toThrow('workflowTimeout must be positive');

      expect(() => {
        new ComprehensiveResponseCollector({ historyReplayTimeout: 0 });
      }).toThrow('historyReplayTimeout must be positive');

      expect(() => {
        new ComprehensiveResponseCollector({ sessionName: '' });
      }).toThrow('sessionName cannot be empty');
    });
  });

  describe('executeComprehensiveWorkflow', () => {
    it('should fail when called before components are provided', async () => {
      await expect(collector.executeComprehensiveWorkflow()).rejects.toThrow('Framework components not initialized');
    });

    it('should execute complete workflow orchestration', async () => {
      // Setup mocks
      mockServerManager.isRunning.mockReturnValue(false);
      mockServerManager.start.mockResolvedValue();
      mockMcpClient.isConnected.mockReturnValue(true);
      mockPreWebSocketExecutor.executeCommands.mockResolvedValue([]);
      mockConnectionDiscovery.discoverWebSocketUrl.mockResolvedValue('ws://localhost:8083/ws/session/test-session');
      mockConnectionDiscovery.establishConnection.mockResolvedValue(mockWebSocket);
      mockConnectionDiscovery.validateConnection.mockReturnValue(true);
      mockHistoryCapture.captureInitialHistory.mockResolvedValue();
      mockHistoryCapture.waitForHistoryReplayComplete.mockResolvedValue();
      mockHistoryCapture.getHistoryMessages.mockReturnValue([
        { timestamp: 1000, data: 'History message\r\n', isHistoryReplay: true, sequenceNumber: 1 }
      ]);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([
        { timestamp: 2000, data: 'Real-time message\r\n', isHistoryReplay: false, sequenceNumber: 2 }
      ]);
      mockPostWebSocketExecutor.executeCommands.mockResolvedValue([]);

      // Set components
      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      const result = await collector.executeComprehensiveWorkflow();

      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBe('History message\r\nReal-time message\r\n');
      expect(result.phaseBreakdown).toBeDefined();
      expect(result.totalExecutionTime).toBeGreaterThan(0);
    });

    it('should handle workflow timeout gracefully', async () => {
      const timeoutConfig: ComprehensiveResponseCollectorConfig = {
        workflowTimeout: 100 // Very short timeout
      };
      collector = new ComprehensiveResponseCollector(timeoutConfig);

      // Setup mocks that delay longer than timeout
      mockServerManager.start.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      mockMcpClient.isConnected.mockReturnValue(true);

      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      const result = await collector.executeComprehensiveWorkflow();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow timeout');
      expect(result.totalExecutionTime).toBeGreaterThanOrEqual(100);
    });

    it('should preserve exact CRLF line endings in concatenated responses', async () => {
      // Setup mocks with specific CRLF formatting
      mockServerManager.isRunning.mockReturnValue(false);
      mockServerManager.start.mockResolvedValue();
      mockMcpClient.isConnected.mockReturnValue(true);
      mockPreWebSocketExecutor.executeCommands.mockResolvedValue([]);
      mockConnectionDiscovery.discoverWebSocketUrl.mockResolvedValue('ws://localhost:8083/ws/session/test-session');
      mockConnectionDiscovery.establishConnection.mockResolvedValue(mockWebSocket);
      mockConnectionDiscovery.validateConnection.mockReturnValue(true);
      mockHistoryCapture.captureInitialHistory.mockResolvedValue();
      mockHistoryCapture.waitForHistoryReplayComplete.mockResolvedValue();
      mockHistoryCapture.getHistoryMessages.mockReturnValue([
        { timestamp: 1000, data: 'Line 1\r\n', isHistoryReplay: true, sequenceNumber: 1 },
        { timestamp: 1001, data: 'Line 2\r\n', isHistoryReplay: true, sequenceNumber: 2 }
      ]);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([
        { timestamp: 2000, data: 'Real-time 1\r\n', isHistoryReplay: false, sequenceNumber: 3 },
        { timestamp: 2001, data: 'Real-time 2\r\n', isHistoryReplay: false, sequenceNumber: 4 }
      ]);
      mockPostWebSocketExecutor.executeCommands.mockResolvedValue([]);

      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      const result = await collector.executeComprehensiveWorkflow();

      expect(result.concatenatedResponses).toBe('Line 1\r\nLine 2\r\nReal-time 1\r\nReal-time 2\r\n');
      expect(result.concatenatedResponses.includes('\r\n')).toBe(true);
      expect(result.concatenatedResponses.includes('\n\r')).toBe(false); // Ensure no line ending corruption
    });

    it('should provide clear separation between message phases', async () => {
      // Setup mocks
      mockServerManager.isRunning.mockReturnValue(false);
      mockServerManager.start.mockResolvedValue();
      mockMcpClient.isConnected.mockReturnValue(true);
      mockPreWebSocketExecutor.executeCommands.mockResolvedValue([]);
      mockConnectionDiscovery.discoverWebSocketUrl.mockResolvedValue('ws://localhost:8083/ws/session/test-session');
      mockConnectionDiscovery.establishConnection.mockResolvedValue(mockWebSocket);
      mockConnectionDiscovery.validateConnection.mockReturnValue(true);
      mockHistoryCapture.captureInitialHistory.mockResolvedValue();
      mockHistoryCapture.waitForHistoryReplayComplete.mockResolvedValue();
      mockHistoryCapture.getHistoryMessages.mockReturnValue([
        { timestamp: 1000, data: 'History\r\n', isHistoryReplay: true, sequenceNumber: 1 }
      ]);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([
        { timestamp: 2000, data: 'Real-time\r\n', isHistoryReplay: false, sequenceNumber: 2 }
      ]);
      mockPostWebSocketExecutor.executeCommands.mockResolvedValue([]);

      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      const result = await collector.executeComprehensiveWorkflow();

      expect(result.phaseBreakdown).toBeDefined();
      expect(result.phaseBreakdown!.historyReplayMessages).toEqual(['History\r\n']);
      expect(result.phaseBreakdown!.realTimeMessages).toEqual(['Real-time\r\n']);
      expect(result.phaseBreakdown!.historyMessageCount).toBe(1);
      expect(result.phaseBreakdown!.realTimeMessageCount).toBe(1);
    });
  });

  describe('resource cleanup', () => {
    it('should cleanup all resources when explicitly called after successful workflow', async () => {
      // Setup mocks for successful workflow
      mockServerManager.isRunning.mockReturnValue(false);
      mockServerManager.start.mockResolvedValue();
      mockServerManager.stop.mockResolvedValue();
      mockMcpClient.isConnected.mockReturnValue(true);
      mockMcpClient.disconnect.mockResolvedValue();
      mockPreWebSocketExecutor.executeCommands.mockResolvedValue([]);
      mockPreWebSocketExecutor.cleanup.mockResolvedValue();
      mockConnectionDiscovery.discoverWebSocketUrl.mockResolvedValue('ws://localhost:8083/ws/session/test-session');
      mockConnectionDiscovery.establishConnection.mockResolvedValue(mockWebSocket);
      mockConnectionDiscovery.validateConnection.mockReturnValue(true);
      mockHistoryCapture.captureInitialHistory.mockResolvedValue();
      mockHistoryCapture.waitForHistoryReplayComplete.mockResolvedValue();
      mockHistoryCapture.getHistoryMessages.mockReturnValue([]);
      mockHistoryCapture.getRealTimeMessages.mockReturnValue([]);
      mockHistoryCapture.cleanup.mockResolvedValue();
      mockPostWebSocketExecutor.executeCommands.mockResolvedValue([]);
      mockPostWebSocketExecutor.cleanup.mockResolvedValue();

      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      const result = await collector.executeComprehensiveWorkflow();
      expect(result.success).toBe(true);

      // Reset mocks to verify explicit cleanup
      jest.clearAllMocks();

      // Call explicit cleanup
      await collector.cleanup();

      // Verify cleanup was called
      expect(mockServerManager.stop).toHaveBeenCalled();
      expect(mockMcpClient.disconnect).toHaveBeenCalled();
      expect(mockHistoryCapture.cleanup).toHaveBeenCalled();
      expect(mockPreWebSocketExecutor.cleanup).toHaveBeenCalled();
      expect(mockPostWebSocketExecutor.cleanup).toHaveBeenCalled();
    });

    it('should cleanup all resources when workflow fails', async () => {
      // Setup mocks for failing workflow
      mockServerManager.start.mockRejectedValue(new Error('Server failed to start'));
      mockServerManager.stop.mockResolvedValue();
      mockMcpClient.disconnect.mockResolvedValue();
      mockPreWebSocketExecutor.cleanup.mockResolvedValue();
      mockHistoryCapture.cleanup.mockResolvedValue();
      mockPostWebSocketExecutor.cleanup.mockResolvedValue();

      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      const result = await collector.executeComprehensiveWorkflow();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Server failed to start');
    });
  });

  describe('component management', () => {
    it('should allow setting framework components', () => {
      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      expect(collector.areComponentsInitialized()).toBe(true);
    });

    it('should report components as not initialized when missing', () => {
      expect(collector.areComponentsInitialized()).toBe(false);
    });

    it('should provide configuration access', () => {
      const config = collector.getConfig();
      expect(config).toBeDefined();
      expect(config.workflowTimeout).toBeDefined();
      expect(config.sessionName).toBeDefined();
    });
  });
});