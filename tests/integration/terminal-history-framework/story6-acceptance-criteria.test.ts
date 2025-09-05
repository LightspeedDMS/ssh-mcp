/**
 * Story 6: Comprehensive Response Collection and Output - Acceptance Criteria Tests
 * 
 * Tests validate the acceptance criteria for Story 6:
 * Given I have executed both pre and post WebSocket phases
 * When all commands complete or timeout occurs
 * Then it should return concatenated WebSocket responses verbatim
 * And preserve exact formatting including CRLF line endings
 * And include both history replay and real-time messages
 * And provide clear separation between message phases
 * And handle timeout scenarios gracefully (10-second limit)
 * And clean up all resources (server, WebSocket, etc.)
 */

import { ComprehensiveResponseCollector } from './comprehensive-response-collector';
import WebSocket from 'ws';

describe('Story 6: Comprehensive Response Collection - Acceptance Criteria', () => {
  let collector: ComprehensiveResponseCollector;
  
  beforeEach(() => {
    collector = new ComprehensiveResponseCollector();
  });

  afterEach(async () => {
    if (collector) {
      await collector.cleanup();
    }
  });

  describe('Acceptance Criteria: Return concatenated WebSocket responses verbatim', () => {
    it('should concatenate WebSocket responses verbatim preserving exact formatting', async () => {
      // Arrange: Create mock components that return predictable responses
      const mockServerManager = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(true),
        getRawProcess: jest.fn().mockReturnValue({ stdin: null, stdout: null })
      } as any;

      const mockMcpClient = {
        isConnected: jest.fn().mockReturnValue(true),
        callTool: jest.fn().mockResolvedValue({ success: true }),
        disconnect: jest.fn().mockResolvedValue(undefined)
      } as any;

      const mockPreWebSocketExecutor = {
        executeCommands: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any;

      const mockConnectionDiscovery = {
        discoverWebSocketUrl: jest.fn().mockResolvedValue('ws://localhost:8083/ws/session/test-session'),
        establishConnection: jest.fn().mockResolvedValue({
          readyState: WebSocket.OPEN,
          close: jest.fn(),
          terminate: jest.fn(),
          removeAllListeners: jest.fn()
        } as any)
      } as any;

      const mockHistoryCapture = {
        captureInitialHistory: jest.fn().mockResolvedValue(undefined),
        waitForHistoryReplayComplete: jest.fn().mockResolvedValue(undefined),
        getHistoryMessages: jest.fn().mockReturnValue([
          { timestamp: 1000, data: 'History message 1\r\n', isHistoryReplay: true, sequenceNumber: 1 },
          { timestamp: 1001, data: 'History message 2\r\n', isHistoryReplay: true, sequenceNumber: 2 }
        ]),
        getRealTimeMessages: jest.fn().mockReturnValue([
          { timestamp: 2000, data: 'Real-time message 1\r\n', isHistoryReplay: false, sequenceNumber: 3 },
          { timestamp: 2001, data: 'Real-time message 2\r\n', isHistoryReplay: false, sequenceNumber: 4 }
        ]),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any;

      const mockPostWebSocketExecutor = {
        executeCommands: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any;

      // Set up collector with mocked components
      collector.setServerManager(mockServerManager);
      collector.setMcpClient(mockMcpClient);
      collector.setPreWebSocketExecutor(mockPreWebSocketExecutor);
      collector.setConnectionDiscovery(mockConnectionDiscovery);
      collector.setHistoryCapture(mockHistoryCapture);
      collector.setPostWebSocketExecutor(mockPostWebSocketExecutor);

      // Act: Execute comprehensive workflow
      const result = await collector.executeComprehensiveWorkflow();

      // Assert: Verify concatenated responses are verbatim and preserve formatting
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBe('History message 1\r\nHistory message 2\r\nReal-time message 1\r\nReal-time message 2\r\n');
      
      // Verify exact formatting preservation (CRLF line endings)
      expect(result.concatenatedResponses.includes('\r\n')).toBe(true);
      expect(result.concatenatedResponses.includes('\n\r')).toBe(false); // No line ending corruption
    });
  });

  describe('Acceptance Criteria: Include both history replay and real-time messages', () => {
    it('should include both history replay and real-time messages with clear separation', async () => {
      // Arrange: Mock components with distinct history and real-time messages
      const mockComponents = createMockComponents();
      
      mockComponents.historyCapture.getHistoryMessages.mockReturnValue([
        { timestamp: 1000, data: 'HISTORY: command output\r\n', isHistoryReplay: true, sequenceNumber: 1 }
      ]);
      mockComponents.historyCapture.getRealTimeMessages.mockReturnValue([
        { timestamp: 2000, data: 'REALTIME: fresh output\r\n', isHistoryReplay: false, sequenceNumber: 2 }
      ]);

      setupCollectorWithMocks(collector, mockComponents);

      // Act: Execute workflow
      const result = await collector.executeComprehensiveWorkflow();

      // Assert: Verify both types of messages are included and separated
      expect(result.success).toBe(true);
      expect(result.phaseBreakdown!.historyMessageCount).toBe(1);
      expect(result.phaseBreakdown!.realTimeMessageCount).toBe(1);
      expect(result.phaseBreakdown!.historyReplayMessages).toEqual(['HISTORY: command output\r\n']);
      expect(result.phaseBreakdown!.realTimeMessages).toEqual(['REALTIME: fresh output\r\n']);
      expect(result.concatenatedResponses).toBe('HISTORY: command output\r\nREALTIME: fresh output\r\n');
    });
  });

  describe('Acceptance Criteria: Handle timeout scenarios gracefully', () => {
    it('should handle workflow timeout gracefully with configurable limit', async () => {
      // Arrange: Create collector with short timeout and slow mock components
      const timeoutCollector = new ComprehensiveResponseCollector({ workflowTimeout: 100 });
      const mockComponents = createMockComponents();
      
      // Make the entire workflow take longer than timeout
      // Server is running but pre-WebSocket commands take too long
      mockComponents.serverManager.isRunning.mockReturnValue(false); // Force server start
      mockComponents.serverManager.start.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined), 50))
      );
      mockComponents.preWebSocketExecutor.executeCommands.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 120)) // This will timeout
      );

      setupCollectorWithMocks(timeoutCollector, mockComponents);

      // Act: Execute workflow
      const result = await timeoutCollector.executeComprehensiveWorkflow();

      // Assert: Verify timeout is handled gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow timeout');
      expect(result.totalExecutionTime).toBeGreaterThanOrEqual(100);

      await timeoutCollector.cleanup();
    });

    it('should use default 10-second timeout when not specified', async () => {
      // Arrange: Create collector with default configuration
      const defaultCollector = new ComprehensiveResponseCollector();
      const config = defaultCollector.getConfig();

      // Assert: Verify default timeout is 10 seconds (10000ms)
      expect(config.workflowTimeout).toBe(10000);

      await defaultCollector.cleanup();
    });
  });

  describe('Acceptance Criteria: Clean up all resources', () => {
    it('should clean up all resources (server, WebSocket, etc.)', async () => {
      // Arrange: Mock components with cleanup tracking
      const mockComponents = createMockComponents();
      setupCollectorWithMocks(collector, mockComponents);

      // Act: Execute workflow and then cleanup
      await collector.executeComprehensiveWorkflow();
      await collector.cleanup();

      // Assert: Verify all cleanup methods were called
      expect(mockComponents.serverManager.stop).toHaveBeenCalled();
      expect(mockComponents.mcpClient.disconnect).toHaveBeenCalled();
      expect(mockComponents.preWebSocketExecutor.cleanup).toHaveBeenCalled();
      expect(mockComponents.historyCapture.cleanup).toHaveBeenCalled();
      expect(mockComponents.postWebSocketExecutor.cleanup).toHaveBeenCalled();
    });
  });

  describe('Acceptance Criteria: Preserve exact formatting including CRLF line endings', () => {
    it('should preserve CRLF line endings required for xterm.js terminal display', async () => {
      // Arrange: Mock components with various line ending formats
      const mockComponents = createMockComponents();
      
      mockComponents.historyCapture.getHistoryMessages.mockReturnValue([
        { timestamp: 1000, data: 'Line 1\r\n', isHistoryReplay: true, sequenceNumber: 1 },
        { timestamp: 1001, data: 'Line 2\r\n', isHistoryReplay: true, sequenceNumber: 2 }
      ]);
      mockComponents.historyCapture.getRealTimeMessages.mockReturnValue([
        { timestamp: 2000, data: 'Real line 1\r\n', isHistoryReplay: false, sequenceNumber: 3 }
      ]);

      setupCollectorWithMocks(collector, mockComponents);

      // Act: Execute workflow
      const result = await collector.executeComprehensiveWorkflow();

      // Assert: Verify CRLF preservation (critical for terminal display)
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBe('Line 1\r\nLine 2\r\nReal line 1\r\n');
      
      // Verify all CRLF sequences are preserved
      const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
      expect(crlfCount).toBe(3);
      
      // Verify no line ending corruption
      expect(result.concatenatedResponses.includes('\n\r')).toBe(false);
    });
  });

  // Helper functions
  function createMockComponents() {
    return {
      serverManager: {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(true),
        getRawProcess: jest.fn().mockReturnValue({ stdin: null, stdout: null })
      } as any,

      mcpClient: {
        isConnected: jest.fn().mockReturnValue(true),
        callTool: jest.fn().mockResolvedValue({ success: true }),
        disconnect: jest.fn().mockResolvedValue(undefined)
      } as any,

      preWebSocketExecutor: {
        executeCommands: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any,

      connectionDiscovery: {
        discoverWebSocketUrl: jest.fn().mockResolvedValue('ws://localhost:8083/ws/session/test-session'),
        establishConnection: jest.fn().mockResolvedValue({
          readyState: WebSocket.OPEN,
          close: jest.fn(),
          terminate: jest.fn(),
          removeAllListeners: jest.fn()
        } as any)
      } as any,

      historyCapture: {
        captureInitialHistory: jest.fn().mockResolvedValue(undefined),
        waitForHistoryReplayComplete: jest.fn().mockResolvedValue(undefined),
        getHistoryMessages: jest.fn().mockReturnValue([]),
        getRealTimeMessages: jest.fn().mockReturnValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any,

      postWebSocketExecutor: {
        executeCommands: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any
    };
  }

  function setupCollectorWithMocks(collector: ComprehensiveResponseCollector, mocks: any) {
    collector.setServerManager(mocks.serverManager);
    collector.setMcpClient(mocks.mcpClient);
    collector.setPreWebSocketExecutor(mocks.preWebSocketExecutor);
    collector.setConnectionDiscovery(mocks.connectionDiscovery);
    collector.setHistoryCapture(mocks.historyCapture);
    collector.setPostWebSocketExecutor(mocks.postWebSocketExecutor);
  }
});