/**
 * WebSocketConnectionDiscovery - Story 3: Dynamic WebSocket Connection Discovery
 * 
 * This class bridges the gap between pre-WebSocket command execution (Story 2) 
 * and WebSocket message capture (Stories 4-5) by providing dynamic WebSocket 
 * connection discovery and establishment capabilities.
 * 
 * Core responsibilities:
 * - Use MCP client to discover monitoring URLs dynamically
 * - Parse HTTP monitoring URLs to WebSocket endpoints
 * - Establish WebSocket connections with validation
 * - Handle connection failures with clear error messages
 */

import WebSocket from 'ws';
import { URL } from 'url';

/**
 * Interface for MCP client that can call tools
 * This represents the dependency from Stories 1-2
 */
export interface MCPClient {
  callTool(toolName: string, args: unknown): Promise<unknown>;
}

/**
 * Response format from ssh_get_monitoring_url MCP tool
 */
export interface MonitoringUrlResponse {
  success: boolean;
  sessionName?: string;
  monitoringUrl?: string;
  error?: string;
}

/**
 * WebSocket connection discovery and establishment
 */
export class WebSocketConnectionDiscovery {
  private mcpClient: MCPClient;
  private defaultConnectionTimeout: number = 5000; // 5 seconds

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Discover WebSocket URL for a session by calling MCP tool
   * @param sessionName Name of the SSH session to discover WebSocket URL for
   * @returns Promise resolving to WebSocket URL string
   */
  async discoverWebSocketUrl(sessionName: string): Promise<string> {
    let response: MonitoringUrlResponse;
    
    console.debug(`[WebSocketConnectionDiscovery] Discovering WebSocket URL for session: ${sessionName}`);
    
    try {
      // ✅ CLAUDE.md COMPLIANCE: Proper exception handling with specific catch
      // Call MCP tool to get monitoring URL
      response = await this.mcpClient.callTool('ssh_get_monitoring_url', {
        sessionName
      }) as MonitoringUrlResponse;
    } catch (error) {
      // ✅ CLAUDE.md COMPLIANCE: Proper error logging and re-throwing
      if (error instanceof Error) {
        throw new Error(`MCP tool call failed: ${error.message}`);
      }
      throw new Error(`MCP tool call failed: ${String(error)}`);
    }

    try {
      // Handle MCP tool failure
      if (!response.success || !response.monitoringUrl) {
        const errorMessage = response.error || 'Unknown error from MCP tool';
        throw new Error(`Failed to discover monitoring URL: ${errorMessage}`);
      }

      // Convert monitoring URL to WebSocket URL
      const webSocketUrl = this.parseMonitoringUrl(response.monitoringUrl);
      console.debug(`[WebSocketConnectionDiscovery] Discovered WebSocket URL: ${webSocketUrl}`);
      return webSocketUrl;
    } catch (error) {
      // Re-throw URL parsing errors as-is
      if (error instanceof Error && error.message.includes('Failed to discover monitoring URL')) {
        throw error;
      }
      throw new Error(`URL parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse HTTP monitoring URL to WebSocket URL
   * Converts: http://localhost:8083/session/test-session 
   * To: ws://localhost:8083/ws/session/test-session
   * 
   * @param monitoringUrl HTTP monitoring URL from MCP server
   * @returns WebSocket URL string
   */
  parseMonitoringUrl(monitoringUrl: string): string {
    try {
      const url = new URL(monitoringUrl);
      
      // Validate protocol
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Unsupported URL protocol. Expected http or https');
      }

      // Convert protocol
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Build WebSocket URL by injecting /ws into path
      const pathParts = url.pathname.split('/');
      if (pathParts.length < 3 || pathParts[1] !== 'session') {
        throw new Error('Invalid monitoring URL format');
      }

      // Construct WebSocket path: /ws/session/SESSION_NAME
      const wsPath = `/ws/session/${pathParts[2]}`;
      
      return `${wsProtocol}//${url.host}${wsPath}`;
    } catch (error) {
      // Re-throw our own validation errors
      if (error instanceof Error && 
          (error.message === 'Unsupported URL protocol. Expected http or https' ||
           error.message === 'Invalid monitoring URL format')) {
        throw error;
      }
      
      // URL constructor throws TypeError with message "Invalid URL" for malformed URLs
      if (error instanceof Error && (error.message === 'Invalid URL' || error.message.includes('Invalid URL'))) {
        throw new Error('Invalid monitoring URL format');
      }
      
      // Fallback for any other URL-related errors
      throw new Error('Invalid monitoring URL format');
    }
  }

  /**
   * Establish WebSocket connection to discovered endpoint
   * @param webSocketUrl WebSocket URL to connect to
   * @param timeout Connection timeout in milliseconds (default: 5000)
   * @returns Promise resolving to established WebSocket connection
   */
  async establishConnection(webSocketUrl: string, timeout?: number): Promise<WebSocket> {
    const connectionTimeout = timeout || this.defaultConnectionTimeout;

    return new Promise((resolve, reject) => {
      let webSocket: WebSocket;
      let timeoutId: ReturnType<typeof setTimeout>;

      // ✅ CLAUDE.md COMPLIANCE: Centralized cleanup function for proper resource management
      const cleanup = (cleanupWebSocket = true): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (webSocket && cleanupWebSocket) {
          webSocket.removeEventListener('open', onOpen);
          webSocket.removeEventListener('error', onError);
        }
      };

      // Connection successful
      const onOpen = (): void => {
        try {
          console.debug(`[WebSocketConnectionDiscovery] WebSocket connection established successfully to: ${webSocketUrl}`);
          cleanup(false); // Don't remove listeners from successful connection
          resolve(webSocket);
        } catch (cleanupError) {
          // If cleanup fails, still try to resolve
          resolve(webSocket);
        }
      };

      // Connection failed 
      const onError = (): void => {
        try {
          cleanup();
          if (webSocket) {
            try {
              webSocket.close();
            } catch (closeError) {
              // Ignore close errors during error handling
            }
          }
        } finally {
          reject(new Error('WebSocket connection failed'));
        }
      };

      // Connection timeout
      const onTimeout = (): void => {
        try {
          cleanup();
          // Don't try to close the WebSocket, just reject - let it timeout naturally
        } finally {
          reject(new Error(`WebSocket connection timeout after ${connectionTimeout}ms`));
        }
      };

      try {
        // Create WebSocket connection
        webSocket = new WebSocket(webSocketUrl);
        
        // Set up event listeners
        webSocket.addEventListener('open', onOpen);
        webSocket.addEventListener('error', onError);
        
        // Set timeout
        timeoutId = setTimeout(onTimeout, connectionTimeout);
      } catch (error) {
        // ✅ CLAUDE.md COMPLIANCE: Proper error handling with cleanup
        cleanup();
        reject(new Error(`Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Validate that WebSocket connection is ready for use
   * @param webSocket WebSocket connection to validate
   * @returns true if connection is open and ready, false otherwise
   */
  validateConnection(webSocket: { readyState: number } | null | undefined): boolean {
    if (!webSocket) {
      return false;
    }
    
    return webSocket.readyState === WebSocket.OPEN;
  }

  /**
   * Set default connection timeout for establish operations
   * @param timeout Timeout in milliseconds
   */
  setDefaultConnectionTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error('Connection timeout must be positive');
    }
    this.defaultConnectionTimeout = timeout;
  }

  /**
   * Get current default connection timeout
   * @returns Timeout in milliseconds
   */
  getDefaultConnectionTimeout(): number {
    return this.defaultConnectionTimeout;
  }
}