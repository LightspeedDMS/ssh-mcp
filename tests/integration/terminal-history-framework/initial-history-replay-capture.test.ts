/**
 * Story 4: Initial History Replay Capture - Unit Tests
 * 
 * Tests for InitialHistoryReplayCapture class that captures initial WebSocket messages
 * when browsers connect to terminal sessions, distinguishing between history replay
 * and real-time messages.
 * 
 * CRITICAL: No mocks in production code. These tests verify real functionality.
 */

import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { EventEmitter } from 'events';

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

describe('InitialHistoryReplayCapture', () => {
  let capture: InitialHistoryReplayCapture;
  
  afterEach(async () => {
    if (capture) {
      await capture.cleanup();
    }
  });

  describe('Class Structure', () => {
    it('should exist and be constructable', () => {
      // This will fail until we create the class - RED phase
      expect(() => {
        capture = new InitialHistoryReplayCapture();
      }).not.toThrow();
    });

    it('should have required public methods', () => {
      capture = new InitialHistoryReplayCapture();
      
      // Core functionality methods
      expect(typeof capture.captureInitialHistory).toBe('function');
      expect(typeof capture.waitForHistoryReplayComplete).toBe('function');
      expect(typeof capture.distinguishMessageTypes).toBe('function');
      expect(typeof capture.getHistoryMessages).toBe('function');
      expect(typeof capture.getRealTimeMessages).toBe('function');
      expect(typeof capture.isCapturing).toBe('function');
      expect(typeof capture.cleanup).toBe('function');
    });
  });

  describe('Configuration', () => {
    it('should accept connection discovery and configuration', () => {
      const realConnectionDiscovery = {} as WebSocketConnectionDiscovery;
      const config = {
        historyReplayTimeout: 10000,
        captureTimeout: 5000,
        maxHistoryMessages: 1000
      };

      expect(() => {
        capture = new InitialHistoryReplayCapture(realConnectionDiscovery, config);
      }).not.toThrow();
    });

    it('should use default configuration when none provided', () => {
      const realConnectionDiscovery = {} as WebSocketConnectionDiscovery;
      capture = new InitialHistoryReplayCapture(realConnectionDiscovery);
      
      const config = capture.getConfig();
      expect(config.historyReplayTimeout).toBe(5000); // Default timeout fixed to prevent race condition
      expect(config.maxHistoryMessages).toBe(10000); // Default max messages
    });
  });

  describe('Message Capture', () => {
    let testWebSocket: TestWebSocket;

    beforeEach(() => {
      testWebSocket = new TestWebSocket();
      capture = new InitialHistoryReplayCapture();
    });

    it('should start capturing messages when captureInitialHistory is called', async () => {
      expect(capture.isCapturing()).toBe(false);
      
      await capture.captureInitialHistory(testWebSocket as any);
      
      expect(capture.isCapturing()).toBe(true);
    });

    it('should listen for WebSocket messages when capturing starts', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Should have attached message listener - verify by checking event listener count
      expect(testWebSocket.listenerCount('message')).toBe(1);
    });

    it('should capture messages in the correct order', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Send some test messages
      testWebSocket.simulateMessage('First message');
      testWebSocket.simulateMessage('Second message');
      testWebSocket.simulateMessage('Third message');
      
      const historyMessages = capture.getHistoryMessages();
      expect(historyMessages).toHaveLength(3);
      expect(historyMessages[0].data).toBe('First message');
      expect(historyMessages[1].data).toBe('Second message');
      expect(historyMessages[2].data).toBe('Third message');
    });

    it('should assign sequence numbers to captured messages', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      testWebSocket.simulateMessage('First message');
      testWebSocket.simulateMessage('Second message');
      
      const historyMessages = capture.getHistoryMessages();
      expect(historyMessages[0].sequenceNumber).toBe(1);
      expect(historyMessages[1].sequenceNumber).toBe(2);
    });

    it('should include timestamps in captured messages', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      const beforeTime = Date.now();
      testWebSocket.simulateMessage('Test message');
      const afterTime = Date.now();
      
      const historyMessages = capture.getHistoryMessages();
      expect(historyMessages[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(historyMessages[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('History Replay vs Real-Time Message Distinction', () => {
    let testWebSocket: TestWebSocket;

    beforeEach(() => {
      testWebSocket = new TestWebSocket();
      capture = new InitialHistoryReplayCapture();
    });

    it('should wait for history replay completion', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // This should wait for some indication that history replay is complete
      const waitPromise = capture.waitForHistoryReplayComplete();
      
      // Should be a promise that eventually resolves
      expect(waitPromise).toBeInstanceOf(Promise);
    });

    it('should distinguish between history replay and real-time messages', async () => {
      // Use a capture with a short timeout for this test
      const testCapture = new InitialHistoryReplayCapture(undefined, { historyReplayTimeout: 50 });
      await testCapture.captureInitialHistory(testWebSocket as any);
      
      // Initially, messages should be marked as history replay
      testWebSocket.simulateMessage('History message 1');
      testWebSocket.simulateMessage('History message 2');
      
      // Simulate completion of history replay
      await testCapture.waitForHistoryReplayComplete();
      
      // Now messages should be marked as real-time
      testWebSocket.simulateMessage('Real-time message 1');
      testWebSocket.simulateMessage('Real-time message 2');
      
      const historyMessages = testCapture.getHistoryMessages();
      const realTimeMessages = testCapture.getRealTimeMessages();
      
      expect(historyMessages).toHaveLength(2);
      expect(realTimeMessages).toHaveLength(2);
      
      expect(historyMessages[0].data).toBe('History message 1');
      expect(historyMessages[1].data).toBe('History message 2');
      expect(realTimeMessages[0].data).toBe('Real-time message 1');
      expect(realTimeMessages[1].data).toBe('Real-time message 2');
      
      expect(historyMessages[0].isHistoryReplay).toBe(true);
      expect(historyMessages[1].isHistoryReplay).toBe(true);
      expect(realTimeMessages[0].isHistoryReplay).toBe(false);
      expect(realTimeMessages[1].isHistoryReplay).toBe(false);

      await testCapture.cleanup();
    });

    it('should handle completion timeout for history replay', async () => {
      const shortTimeoutCapture = new InitialHistoryReplayCapture(undefined, {
        historyReplayTimeout: 100 // Very short timeout for testing
      });
      
      await shortTimeoutCapture.captureInitialHistory(testWebSocket as any);
      
      // Should timeout and resolve after the specified time
      const startTime = Date.now();
      await shortTimeoutCapture.waitForHistoryReplayComplete();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(95);

      await shortTimeoutCapture.cleanup();
    });

    it('should correctly identify message types with distinguishMessageTypes', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      const historyMessage: any = {
        timestamp: Date.now(),
        data: 'Test message',
        isHistoryReplay: true,
        sequenceNumber: 1
      };
      
      const realTimeMessage: any = {
        timestamp: Date.now(),
        data: 'Test message',
        isHistoryReplay: false,
        sequenceNumber: 2
      };
      
      expect(capture.distinguishMessageTypes(historyMessage)).toBe(true);
      expect(capture.distinguishMessageTypes(realTimeMessage)).toBe(false);
    });
  });

  describe('Empty History Handling', () => {
    let testWebSocket: TestWebSocket;

    beforeEach(() => {
      testWebSocket = new TestWebSocket();
      capture = new InitialHistoryReplayCapture();
    });

    it('should handle empty history gracefully', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // No messages sent during history replay period
      const shortTimeoutCapture = new InitialHistoryReplayCapture(undefined, { historyReplayTimeout: 50 });
      await shortTimeoutCapture.captureInitialHistory(testWebSocket as any);
      await shortTimeoutCapture.waitForHistoryReplayComplete();
      
      const historyMessages = shortTimeoutCapture.getHistoryMessages();
      const realTimeMessages = shortTimeoutCapture.getRealTimeMessages();
      
      expect(historyMessages).toHaveLength(0);
      expect(realTimeMessages).toHaveLength(0);

      await shortTimeoutCapture.cleanup();
    });

    it('should transition to real-time mode even with no history messages', async () => {
      const shortTimeoutCapture = new InitialHistoryReplayCapture(undefined, { historyReplayTimeout: 50 });
      await shortTimeoutCapture.captureInitialHistory(testWebSocket as any);
      
      // Wait for history replay to complete without any messages
      await shortTimeoutCapture.waitForHistoryReplayComplete();
      
      // Now send a real-time message
      testWebSocket.simulateMessage('Real-time message after empty history');
      
      const historyMessages = shortTimeoutCapture.getHistoryMessages();
      const realTimeMessages = shortTimeoutCapture.getRealTimeMessages();
      
      expect(historyMessages).toHaveLength(0);
      expect(realTimeMessages).toHaveLength(1);
      expect(realTimeMessages[0].data).toBe('Real-time message after empty history');
      expect(realTimeMessages[0].isHistoryReplay).toBe(false);

      await shortTimeoutCapture.cleanup();
    });

    it('should respect maxHistoryMessages limit', async () => {
      const limitedCapture = new InitialHistoryReplayCapture(undefined, { 
        maxHistoryMessages: 2,
        historyReplayTimeout: 1000 // Long enough for test
      });
      
      await limitedCapture.captureInitialHistory(testWebSocket as any);
      
      // Send more messages than the limit
      testWebSocket.simulateMessage('History message 1');
      testWebSocket.simulateMessage('History message 2');
      testWebSocket.simulateMessage('History message 3'); // Should be dropped
      testWebSocket.simulateMessage('History message 4'); // Should be dropped
      
      const historyMessages = limitedCapture.getHistoryMessages();
      expect(historyMessages).toHaveLength(2);
      expect(historyMessages[0].data).toBe('History message 1');
      expect(historyMessages[1].data).toBe('History message 2');

      await limitedCapture.cleanup();
    });
  });

  describe('Cleanup', () => {
    let testWebSocket: TestWebSocket;

    beforeEach(() => {
      testWebSocket = new TestWebSocket();
      capture = new InitialHistoryReplayCapture();
    });

    it('should properly cleanup resources and cancel timers', async () => {
      await capture.captureInitialHistory(testWebSocket as any);
      
      // Should have message listener attached
      expect(testWebSocket.listenerCount('message')).toBe(1);
      expect(capture.isCapturing()).toBe(true);
      
      // Cleanup should remove listeners and stop capturing
      await capture.cleanup();
      
      expect(testWebSocket.listenerCount('message')).toBe(0);
      expect(capture.isCapturing()).toBe(false);
    });
  });
});