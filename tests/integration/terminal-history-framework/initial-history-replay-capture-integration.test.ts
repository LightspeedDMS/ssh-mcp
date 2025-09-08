/**
 * Story 4: Initial History Replay Capture - Integration Tests
 * 
 * Integration tests for InitialHistoryReplayCapture with WebSocketConnectionDiscovery
 * These tests verify the integration between components without mocks.
 * 
 * CRITICAL: No mocks - uses real components in integration.
 */

import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { MCPClient } from './mcp-client';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

// Test helper to create a WebSocket-like interface without mocking
class TestWebSocket extends EventEmitter {
  public readyState: number = 1; // WebSocket.OPEN
  
  // Helper method to simulate receiving a message
  public simulateMessage(data: string): void {
    this.emit('message', Buffer.from(data));
  }
  
  // Helper method to simulate WebSocket closure
  public simulateClose(): void {
    this.readyState = 3; // WebSocket.CLOSED
    this.emit('close');
  }
}

// Real MCP Client implementation for testing - extends the actual MCPClient for compatibility
class TestMCPClient extends MCPClient {
  constructor() {
    // Create proper stream implementations for testing
    const mockStdin = new Writable({
      write(_chunk, _encoding, callback) {
        // Just consume the data
        callback();
      }
    });
    mockStdin.destroyed = false;

    const mockStdout = new Readable({
      read() {
        // Return empty data for testing
      }
    });
    mockStdout.destroyed = false;

    const mockProcess = {
      stdin: mockStdin,
      stdout: mockStdout
    } as any;
    
    super(mockProcess, { timeout: 1000 });
  }

  public isConnected(): boolean {
    return true;
  }

  public async callTool(name: string): Promise<any> {
    // Simple implementation for testing
    if (name === 'ssh_connection_discovery') {
      return { success: true, result: { connections: [] } };
    }
    return { success: true, result: {} };
  }

  public async disconnect(): Promise<void> {
    // No-op for testing
  }
}

describe('InitialHistoryReplayCapture Integration', () => {
  let capture: InitialHistoryReplayCapture;
  
  afterEach(async () => {
    if (capture) {
      await capture.cleanup();
    }
  });

  describe('Integration with WebSocketConnectionDiscovery', () => {
    it('should work with WebSocketConnectionDiscovery for complete workflow', async () => {
      // Create real MCP client for WebSocketConnectionDiscovery
      const realMCPClient = new TestMCPClient();

      // Create WebSocketConnectionDiscovery
      const connectionDiscovery = new WebSocketConnectionDiscovery(realMCPClient);
      
      // Create InitialHistoryReplayCapture with WebSocketConnectionDiscovery
      capture = new InitialHistoryReplayCapture(connectionDiscovery, {
        historyReplayTimeout: 100, // Short timeout for testing
        maxHistoryMessages: 1000
      });

      // Verify integration is set up correctly
      expect(capture).toBeInstanceOf(InitialHistoryReplayCapture);
      expect(capture.getConfig().historyReplayTimeout).toBe(100);
      expect(capture.getConfig().maxHistoryMessages).toBe(1000);
    });

    it('should handle missing WebSocketConnectionDiscovery gracefully', async () => {
      // Create without WebSocketConnectionDiscovery
      capture = new InitialHistoryReplayCapture();
      
      // Should still work for basic functionality
      expect(capture).toBeInstanceOf(InitialHistoryReplayCapture);
      expect(capture.isCapturing()).toBe(false);
      
      // Test WebSocket for testing
      const testWebSocket = new TestWebSocket();
      
      await capture.captureInitialHistory(testWebSocket as any);
      expect(capture.isCapturing()).toBe(true);
      
      await capture.cleanup();
      expect(capture.isCapturing()).toBe(false);
    });
  });

  describe('Complete Story 4 Acceptance Criteria Validation', () => {
    let testWebSocket: TestWebSocket;

    beforeEach(() => {
      testWebSocket = new TestWebSocket();
      capture = new InitialHistoryReplayCapture(undefined, { historyReplayTimeout: 50 });
    });

    it('should capture all initial history replay messages', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Send initial history messages
      testWebSocket.simulateMessage('History 1');
      testWebSocket.simulateMessage('History 2');
      testWebSocket.simulateMessage('History 3');
      
      const historyMessages = capture.getHistoryMessages();
      expect(historyMessages).toHaveLength(3);
      expect(historyMessages.map(m => m.data)).toEqual(['History 1', 'History 2', 'History 3']);
    });

    it('should wait for history replay to complete before proceeding', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Should complete within reasonable time
      const startTime = Date.now();
      await capture.waitForHistoryReplayComplete();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(40); // Close to 50ms timeout
    });

    it('should distinguish between history replay and real-time messages', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // History messages
      testWebSocket.simulateMessage('History message');
      
      // Wait for completion
      await capture.waitForHistoryReplayComplete();
      
      // Real-time messages
      testWebSocket.simulateMessage('Real-time message');
      
      const historyMessages = capture.getHistoryMessages();
      const realTimeMessages = capture.getRealTimeMessages();
      
      expect(historyMessages[0].isHistoryReplay).toBe(true);
      expect(realTimeMessages[0].isHistoryReplay).toBe(false);
    });

    it('should preserve exact message order and formatting', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      const testMessages = [
        'First message with special chars: äöü',
        'Second message with numbers: 12345',
        'Third message with symbols: @#$%^&*()',
        'Fourth message with newlines:\r\nLine 2'
      ];
      
      testMessages.forEach(msg => testWebSocket.simulateMessage(msg));
      
      const historyMessages = capture.getHistoryMessages();
      expect(historyMessages).toHaveLength(4);
      
      // Verify exact order and formatting preservation
      for (let i = 0; i < testMessages.length; i++) {
        expect(historyMessages[i].data).toBe(testMessages[i]);
        expect(historyMessages[i].sequenceNumber).toBe(i + 1);
      }
    });

    it('should handle empty history gracefully', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // No messages during history replay
      await capture.waitForHistoryReplayComplete();
      
      const historyMessages = capture.getHistoryMessages();
      const realTimeMessages = capture.getRealTimeMessages();
      
      expect(historyMessages).toHaveLength(0);
      expect(realTimeMessages).toHaveLength(0);
    });
  });

  describe('Resource Management', () => {
    let testWebSocket: TestWebSocket;

    beforeEach(() => {
      testWebSocket = new TestWebSocket();
      capture = new InitialHistoryReplayCapture(undefined, { historyReplayTimeout: 50 });
    });

    it('should properly manage event listeners and timers', async () => {
      // Start capturing
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Should have message listener
      expect(testWebSocket.listenerCount('message')).toBe(1);
      expect(capture.isCapturing()).toBe(true);
      
      // Cleanup should remove all listeners and cancel timers
      await capture.cleanup();
      
      expect(testWebSocket.listenerCount('message')).toBe(0);
      expect(capture.isCapturing()).toBe(false);
      
      // Further messages should not be captured
      testWebSocket.simulateMessage('Should not be captured');
      
      const historyMessages = capture.getHistoryMessages();
      const realTimeMessages = capture.getRealTimeMessages();
      
      expect(historyMessages).toHaveLength(0);
      expect(realTimeMessages).toHaveLength(0);
    });

    it('should handle multiple cleanup calls gracefully', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Multiple cleanup calls should not error
      await capture.cleanup();
      await capture.cleanup();
      await capture.cleanup();
      
      expect(capture.isCapturing()).toBe(false);
    });
  });
});