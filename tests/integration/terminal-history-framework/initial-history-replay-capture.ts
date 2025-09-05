/**
 * Story 4: Initial History Replay Capture Implementation
 * 
 * InitialHistoryReplayCapture captures initial WebSocket messages when browsers connect
 * to terminal sessions, distinguishing between history replay and real-time messages.
 * 
 * This class works with WebSocketConnectionDiscovery from Story 3 to capture the initial
 * terminal history that browsers see when they first load the terminal.
 * 
 * CRITICAL: No mocks in production code. This uses real WebSocket connections.
 */

import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import WebSocket from 'ws';

/**
 * Configuration for InitialHistoryReplayCapture
 */
export interface InitialHistoryReplayCaptureConfig {
  historyReplayTimeout?: number;  // How long to wait for history replay to complete
  captureTimeout?: number;        // How long to capture messages
  maxHistoryMessages?: number;    // Maximum number of history messages to capture
}

/**
 * Represents a captured WebSocket message
 */
export interface CapturedMessage {
  timestamp: number;
  data: string;
  isHistoryReplay: boolean;
  sequenceNumber: number;
}

/**
 * InitialHistoryReplayCapture class - captures initial terminal history on WebSocket connection
 */
export class InitialHistoryReplayCapture {
  private connectionDiscovery?: WebSocketConnectionDiscovery;
  private config: Required<InitialHistoryReplayCaptureConfig>;
  private capturing: boolean = false;
  private historyMessages: CapturedMessage[] = [];
  private realTimeMessages: CapturedMessage[] = [];
  private sequenceNumber: number = 0;
  private messageHandler?: (data: Buffer) => void;
  private currentWebSocket?: WebSocket;
  private historyReplayComplete: boolean = false;
  private historyReplayPromise?: Promise<void>;
  private historyReplayTimerRef?: NodeJS.Timeout;

  constructor(
    connectionDiscovery?: WebSocketConnectionDiscovery, 
    config: InitialHistoryReplayCaptureConfig = {}
  ) {
    this.connectionDiscovery = connectionDiscovery;
    this.config = {
      historyReplayTimeout: config.historyReplayTimeout ?? 5000, // Fixed: Must be much shorter than workflow timeout to prevent race condition
      captureTimeout: config.captureTimeout ?? 60000,
      maxHistoryMessages: config.maxHistoryMessages ?? 10000
    };
  }

  /**
   * Start capturing initial history replay messages
   */
  async captureInitialHistory(webSocket: WebSocket): Promise<void> {
    this.capturing = true;
    this.sequenceNumber = 0;
    this.currentWebSocket = webSocket;
    this.historyReplayComplete = false;
    
    // Initialize connection discovery if provided
    if (this.connectionDiscovery) {
      // Will be used in future implementation
    }

    // Create message handler for capturing WebSocket messages
    this.messageHandler = (data: Buffer) => {
      this.handleMessage(data.toString());
    };

    // Attach message listener to WebSocket
    webSocket.on('message', this.messageHandler);

    // Start the history replay completion timer
    this.startHistoryReplayTimer();
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    if (!this.capturing) {
      return;
    }

    // Parse JSON WebSocket message and extract terminal data
    // CRITICAL: Extract only the terminal data field to preserve CRLF formatting
    let terminalData: string;
    try {
      const parsed = JSON.parse(data);
      // Extract the actual terminal data from the JSON message
      terminalData = parsed.data || '';
    } catch (error) {
      // If not JSON or no data field, treat as raw message (fallback)
      terminalData = data;
    }

    const capturedMessage: CapturedMessage = {
      timestamp: Date.now(),
      data: terminalData, // Store only the terminal data, not the JSON wrapper
      isHistoryReplay: !this.historyReplayComplete, // History replay if not yet complete
      sequenceNumber: ++this.sequenceNumber
    };

    // Separate messages based on whether history replay is complete
    if (this.historyReplayComplete) {
      this.realTimeMessages.push(capturedMessage);
    } else {
      // Check maxHistoryMessages limit
      if (this.historyMessages.length < this.config.maxHistoryMessages) {
        this.historyMessages.push(capturedMessage);
      }
      // If limit exceeded, silently drop the message (for history replay phase only)
    }
  }

  /**
   * Start history replay completion timer
   */
  private startHistoryReplayTimer(): void {
    this.historyReplayPromise = new Promise<void>((resolve) => {
      this.historyReplayTimerRef = setTimeout(() => {
        this.historyReplayComplete = true;
        resolve();
      }, this.config.historyReplayTimeout);
    });
  }

  /**
   * Wait for history replay to complete
   */
  async waitForHistoryReplayComplete(): Promise<void> {
    if (this.historyReplayPromise) {
      await this.historyReplayPromise;
    }
  }

  /**
   * Distinguish between history replay and real-time messages
   */
  distinguishMessageTypes(message: CapturedMessage): boolean {
    // Minimal implementation - will be expanded with TDD
    return message.isHistoryReplay;
  }

  /**
   * Get captured history messages
   */
  getHistoryMessages(): CapturedMessage[] {
    return [...this.historyMessages];
  }

  /**
   * Get captured real-time messages
   */
  getRealTimeMessages(): CapturedMessage[] {
    return [...this.realTimeMessages];
  }

  /**
   * Check if currently capturing messages
   */
  isCapturing(): boolean {
    return this.capturing;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<InitialHistoryReplayCaptureConfig> {
    return { ...this.config };
  }

  /**
   * Get current sequence number
   */
  getSequenceNumber(): number {
    return this.sequenceNumber;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.capturing = false;
    
    // Remove event listeners
    if (this.currentWebSocket && this.messageHandler) {
      this.currentWebSocket.off('message', this.messageHandler);
    }
    
    // Cancel any pending timer
    if (this.historyReplayTimerRef) {
      clearTimeout(this.historyReplayTimerRef);
      this.historyReplayTimerRef = undefined;
    }
    
    // Clear data
    this.historyMessages = [];
    this.realTimeMessages = [];
    this.sequenceNumber = 0;
    this.messageHandler = undefined;
    this.currentWebSocket = undefined;
    this.historyReplayComplete = false;
    this.historyReplayPromise = undefined;
  }
}