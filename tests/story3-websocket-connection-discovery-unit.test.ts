/**
 * Story 3: Dynamic WebSocket Connection Discovery - Unit Tests
 * 
 * Tests the WebSocketConnectionDiscovery class which bridges the gap between
 * pre-WebSocket command execution (Story 2) and WebSocket message capture (Stories 4-5).
 * 
 * Key functionality:
 * - Use MCPClient to discover monitoring URL dynamically  
 * - Parse HTTP monitoring URL to WebSocket endpoint
 * - Establish and validate WebSocket connection readiness
 * - Handle connection failures with clear error messages
 */

import { WebSocketConnectionDiscovery } from './integration/terminal-history-framework/websocket-connection-discovery.js';

describe('Story 3: WebSocketConnectionDiscovery - Unit Tests', () => {
  describe('Basic Structure', () => {
    it('should construct WebSocketConnectionDiscovery with MCPClient dependency', () => {
      // ARRANGE: Mock MCP client (for dependency injection)
      const mockMCPClient = {
        callTool: jest.fn(),
      };

      // ACT & ASSERT: Constructor should accept MCPClient dependency
      expect(() => {
        new WebSocketConnectionDiscovery(mockMCPClient);
      }).not.toThrow();
    });

    it('should expose required public methods for WebSocket connection workflow', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ASSERT: Required methods for WebSocket discovery and connection
      expect(typeof discovery.discoverWebSocketUrl).toBe('function');
      expect(typeof discovery.establishConnection).toBe('function');
      expect(typeof discovery.validateConnection).toBe('function');
      expect(typeof discovery.parseMonitoringUrl).toBe('function');
    });
  });

  describe('URL Parsing', () => {
    it('should convert HTTP monitoring URL to WebSocket URL correctly', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);
      const monitoringUrl = 'http://localhost:8083/session/test-session';
      const expectedWebSocketUrl = 'ws://localhost:8083/ws/session/test-session';

      // ACT
      const result = discovery.parseMonitoringUrl(monitoringUrl);

      // ASSERT
      expect(result).toBe(expectedWebSocketUrl);
    });

    it('should convert HTTPS monitoring URL to WSS URL correctly', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);
      const monitoringUrl = 'https://localhost:8083/session/test-session';
      const expectedWebSocketUrl = 'wss://localhost:8083/ws/session/test-session';

      // ACT
      const result = discovery.parseMonitoringUrl(monitoringUrl);

      // ASSERT
      expect(result).toBe(expectedWebSocketUrl);
    });

    it('should throw clear error for invalid monitoring URL format', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);
      const invalidUrl = 'not-a-valid-url';

      // ACT & ASSERT
      expect(() => {
        discovery.parseMonitoringUrl(invalidUrl);
      }).toThrow('Invalid monitoring URL format');
    });

    it('should throw clear error for unsupported URL protocol', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);
      const unsupportedUrl = 'ftp://localhost:8083/session/test-session';

      // ACT & ASSERT
      expect(() => {
        discovery.parseMonitoringUrl(unsupportedUrl);
      }).toThrow('Unsupported URL protocol. Expected http or https');
    });
  });

  describe('MCP Client Integration', () => {
    it('should use MCPClient to call ssh_get_monitoring_url tool', async () => {
      // ARRANGE
      const mockMCPClient = {
        callTool: jest.fn().mockResolvedValue({
          success: true,
          sessionName: 'test-session',
          monitoringUrl: 'http://localhost:8083/session/test-session'
        })
      };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);
      const sessionName = 'test-session';

      // ACT
      const result = await discovery.discoverWebSocketUrl(sessionName);

      // ASSERT
      expect(mockMCPClient.callTool).toHaveBeenCalledWith(
        'ssh_get_monitoring_url',
        { sessionName: 'test-session' }
      );
      expect(result).toBe('ws://localhost:8083/ws/session/test-session');
    });

    it('should handle MCP tool failure with clear error message', async () => {
      // ARRANGE
      const mockMCPClient = {
        callTool: jest.fn().mockResolvedValue({
          success: false,
          error: 'Session not found'
        })
      };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ACT & ASSERT
      await expect(discovery.discoverWebSocketUrl('nonexistent-session'))
        .rejects.toThrow('Failed to discover monitoring URL: Session not found');
    });

    it('should handle MCP tool exception with wrapped error', async () => {
      // ARRANGE
      const mockMCPClient = {
        callTool: jest.fn().mockRejectedValue(new Error('Network connection failed'))
      };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ACT & ASSERT
      await expect(discovery.discoverWebSocketUrl('test-session'))
        .rejects.toThrow('MCP tool call failed: Network connection failed');
    });
  });

  describe('WebSocket Connection Establishment', () => {
    it('should have establishConnection method with correct signature', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ASSERT: Method exists and can be called
      expect(typeof discovery.establishConnection).toBe('function');
      expect(discovery.establishConnection.length).toBeGreaterThanOrEqual(1); // At least URL parameter
    });

    it('should have timeout configuration methods', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ASSERT: Timeout configuration methods exist
      expect(typeof discovery.setDefaultConnectionTimeout).toBe('function');
      expect(typeof discovery.getDefaultConnectionTimeout).toBe('function');

      // Default timeout should be reasonable (5 seconds)
      expect(discovery.getDefaultConnectionTimeout()).toBe(5000);
    });

    it('should validate connection timeout parameters', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ACT & ASSERT: Should reject invalid timeout values
      expect(() => {
        discovery.setDefaultConnectionTimeout(0);
      }).toThrow('Connection timeout must be positive');

      expect(() => {
        discovery.setDefaultConnectionTimeout(-100);
      }).toThrow('Connection timeout must be positive');

      // Should accept valid timeout
      expect(() => {
        discovery.setDefaultConnectionTimeout(1000);
      }).not.toThrow();

      expect(discovery.getDefaultConnectionTimeout()).toBe(1000);
    });
  });

  describe('Connection Validation', () => {
    it('should validate WebSocket connection readiness correctly', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);
      
      const readyWebSocket = { readyState: 1 }; // WebSocket.OPEN
      const connectingWebSocket = { readyState: 0 }; // WebSocket.CONNECTING  
      const closedWebSocket = { readyState: 3 }; // WebSocket.CLOSED

      // ACT & ASSERT
      expect(discovery.validateConnection(readyWebSocket)).toBe(true);
      expect(discovery.validateConnection(connectingWebSocket)).toBe(false);
      expect(discovery.validateConnection(closedWebSocket)).toBe(false);
    });

    it('should handle null or undefined WebSocket gracefully', () => {
      // ARRANGE
      const mockMCPClient = { callTool: jest.fn() };
      const discovery = new WebSocketConnectionDiscovery(mockMCPClient);

      // ACT & ASSERT
      expect(discovery.validateConnection(null)).toBe(false);
      expect(discovery.validateConnection(undefined)).toBe(false);
    });
  });
});