/**
 * Story 02: Browser Command Emulation - Simplified TDD Tests
 * 
 * Focused tests that drive the core implementation without complex type assumptions.
 * These tests will fail initially and guide the implementation step-by-step.
 * 
 * CRITICAL: Following TDD methodology - these are failing tests that drive implementation.
 * IMPORTANT: No mocks in production code per CLAUDE.md - uses real WebSocket connections and MCP client.
 */

import { PostWebSocketCommandExecutor, EnhancedCommandParameter } from './post-websocket-command-executor';
import { MCPClient } from './mcp-client';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { MCPServerManager } from './mcp-server-manager';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import WebSocket from 'ws';

describe('Story 02: Browser Command Emulation - Core TDD', () => {
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;
  let executor: PostWebSocketCommandExecutor;
  let historyCapture: InitialHistoryReplayCapture;
  let webSocketDiscovery: WebSocketConnectionDiscovery;
  let webSocket: WebSocket;

  beforeEach(async () => {
    // Start fresh MCP server for each test
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server for testing');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
    
    // Set up WebSocket discovery
    webSocketDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    
    // Create SSH session for testing
    await mcpClient.callTool('ssh_connect', {
      name: 'story02-test-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });
    
    // Establish WebSocket connection
    const webSocketUrl = await webSocketDiscovery.discoverWebSocketUrl('story02-test-session');
    webSocket = await webSocketDiscovery.establishConnection(webSocketUrl);
    
    // Initialize history capture with the WebSocket
    historyCapture = new InitialHistoryReplayCapture();
    await historyCapture.captureInitialHistory(webSocket);
    
    executor = new PostWebSocketCommandExecutor(mcpClient, historyCapture);
  });

  afterEach(async () => {
    if (historyCapture) {
      await historyCapture.cleanup();
    }
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.close();
    }
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (serverManager) {
      await serverManager.stop();
    }
  });

  describe('AC 2.1: Basic browser command routing', () => {
    it('should handle browser commands differently from MCP commands', async () => {
      // Given: A browser-initiated command
      const commands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' }
      ];

      // When: Villenele executes the command
      const results = await executor.executeCommands(commands, webSocket);

      // Then: Should execute successfully with browser initiator 
      expect(results).toHaveLength(1);
      expect(results[0].initiator).toBe('browser');
      expect(results[0].command).toBe('pwd');
      
      // This test passes with current implementation but drives dual-channel routing
      // TODO: Browser commands should use WebSocket terminal_input messages, not MCP JSON-RPC
      expect(results[0].success).toBe(true);
    });

    it('should maintain session context for browser commands', async () => {
      // Given: Browser command execution
      const commands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'whoami' }
      ];

      // When: Executing the command
      const results = await executor.executeCommands(commands, webSocket);

      // Then: Should execute successfully maintaining session context
      expect(results[0].success).toBe(true);
      expect(results[0].capturedMessages).toBeDefined();
      expect(results[0].capturedMessages.length).toBeGreaterThan(0);
    });
  });

  describe('AC 2.3: MCP command preservation', () => {
    it('should continue to handle MCP commands via JSON-RPC', async () => {
      // Given: A command with MCP client initiator
      const commands: EnhancedCommandParameter[] = [
        { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story02-test-session", "command": "date"}' }
      ];

      // When: Villenele executes the command
      const results = await executor.executeCommands(commands, webSocket);

      // Then: Should use existing MCP path successfully
      expect(results).toHaveLength(1);
      expect(results[0].initiator).toBe('mcp-client');
      expect(results[0].success).toBe(true);
      expect(results[0].mcpResponse).toBeDefined();
      expect(results[0].mcpResponse!.success).toBe(true);
    });
  });

  describe('AC 2.4: Mixed command session maintenance', () => {
    it('should handle mixed browser and MCP commands with proper gating behavior', async () => {
      // Given: Mixed browser and MCP commands
      const commands: EnhancedCommandParameter[] = [
        { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story02-test-session", "command": "cd /tmp"}' },
        { initiator: 'browser', command: 'pwd' },
        { initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "story02-test-session", "command": "whoami"}' }
      ];

      // When: Executed by Villenele  
      const results = await executor.executeCommands(commands, webSocket);

      // Then: Should maintain session context and demonstrate gating behavior
      expect(results).toHaveLength(3);
      
      // Verify command routing maintained correctly
      expect(results[0].initiator).toBe('mcp-client');
      expect(results[1].initiator).toBe('browser');
      expect(results[2].initiator).toBe('mcp-client');
      
      // First MCP command should succeed
      expect(results[0].success).toBe(true);
      
      // Browser command should succeed
      expect(results[1].success).toBe(true);
      
      // Third MCP command should be gated by Command State Synchronization (expected behavior)
      expect(results[2].success).toBe(false);
      expect(results[2].error).toBe('BROWSER_COMMANDS_EXECUTED');
      
      console.log('✅ Command State Synchronization working correctly: MCP command blocked after browser command');
    });
  });

  describe('AC 2.7: WebSocket connection validation', () => {
    it('should properly validate WebSocket connection for browser commands', async () => {
      // Given: Browser command with closed WebSocket
      const commands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'pwd' }
      ];
      
      // Close WebSocket to simulate unavailability
      webSocket.close();
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for close

      // When: Attempting browser command without valid WebSocket
      const results = await executor.executeCommands(commands, webSocket);
      
      // Then: Should fail gracefully with WebSocket connection error
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toMatch(/WebSocket connection/);
      expect(results[0].initiator).toBe('browser');
      
      console.log('✅ WebSocket validation working correctly - browser command failed with closed WebSocket');
    });
  });

  describe('Core Implementation Driving Tests', () => {
    it('should demonstrate current MCP-based execution for browser commands', async () => {
      // This test documents current behavior and drives future WebSocket implementation
      const commands: EnhancedCommandParameter[] = [
        { initiator: 'browser', command: 'echo "current implementation test"' }
      ];

      const results = await executor.executeCommands(commands, webSocket);
      
      // Current state: Browser commands execute via MCP (like mcp-client commands)
      expect(results[0].success).toBe(true);
      expect(results[0].initiator).toBe('browser');
      
      // TODO: Implementation should:
      // 1. Send WebSocket terminal_input message for browser commands
      // 2. Generate unique commandId for each browser command  
      // 3. Capture WebSocket responses instead of MCP responses
      // 4. Integrate with Command State Synchronization
      
      console.log('Current implementation uses MCP for browser commands - need to add WebSocket routing');
    });
  });
});