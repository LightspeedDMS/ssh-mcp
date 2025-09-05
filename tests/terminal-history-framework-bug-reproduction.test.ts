/**
 * Terminal History Framework Bug Reproduction Tests
 * 
 * This test reproduces the exact WebSocket discovery bug: "Session 'prompt-display-test' not found"
 * even though SSH connection was successfully established.
 * 
 * Root cause: ssh_create_session fallback still exists in comprehensive-response-collector.ts line 104
 * and validation tests use incorrect ssh_create_session commands.
 */

import { ComprehensiveResponseCollector } from './integration/terminal-history-framework/comprehensive-response-collector';
import { MCPServerManager } from './integration/terminal-history-framework/mcp-server-manager';
import { MCPClient } from './integration/terminal-history-framework/mcp-client';
import { PreWebSocketCommandExecutor } from './integration/terminal-history-framework/pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './integration/terminal-history-framework/websocket-connection-discovery';
import { InitialHistoryReplayCapture } from './integration/terminal-history-framework/initial-history-replay-capture';
import { PostWebSocketCommandExecutor } from './integration/terminal-history-framework/post-websocket-command-executor';

describe('Terminal History Framework Bug Reproduction', () => {
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;
  let responseCollector: ComprehensiveResponseCollector;

  beforeEach(async () => {
    // Setup components
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const serverProcess = serverManager.getRawProcess();
    if (!serverProcess) {
      throw new Error('Failed to get MCP server process after starting');
    }

    mcpClient = new MCPClient(serverProcess);
  });

  afterEach(async () => {
    if (responseCollector) {
      await responseCollector.cleanup();
    }
    if (serverManager) {
      await serverManager.stop();
    }
  });

  describe('WebSocket Discovery Bug Reproduction', () => {
    it('FAILS: should reproduce "Session not found" error with ssh_connect but ssh_create_session fallback', async () => {
      // ARRANGE - Create configuration that should work but fails due to fallback bug
      responseCollector = new ComprehensiveResponseCollector({
        workflowTimeout: 15000,
        sessionName: 'bug-reproduction-test',
        preWebSocketCommands: [
          // This works - establishes SSH connection
          { tool: 'ssh_connect', args: { name: 'bug-reproduction-test', host: 'localhost', username: 'jsbattig', keyFilePath: '~/.ssh/id_ed25519' } },
          // This also works - executes command in established session
          { tool: 'ssh_exec', args: { sessionName: 'bug-reproduction-test', command: 'ls' } }
        ]
      });

      // Initialize components
      const preWebSocketExecutor = new PreWebSocketCommandExecutor(mcpClient);
      const webSocketConnectionDiscovery = new WebSocketConnectionDiscovery(mcpClient);
      const initialHistoryReplayCapture = new InitialHistoryReplayCapture();
      const postWebSocketCommandExecutor = new PostWebSocketCommandExecutor(mcpClient);

      responseCollector.setServerManager(serverManager);
      responseCollector.setMcpClient(mcpClient);
      responseCollector.setPreWebSocketExecutor(preWebSocketExecutor);
      responseCollector.setConnectionDiscovery(webSocketConnectionDiscovery);
      responseCollector.setHistoryCapture(initialHistoryReplayCapture);
      responseCollector.setPostWebSocketExecutor(postWebSocketCommandExecutor);

      // ACT & ASSERT - This should fail with "Session 'bug-reproduction-test' not found"
      // because of the ssh_create_session fallback in line 104
      try {
        const result = await responseCollector.executeComprehensiveWorkflow();
        
        // If it succeeds, the bug is already fixed
        expect(result.success).toBe(true);
        console.log('✅ Bug already fixed! WebSocket discovery working properly');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // This is the expected bug behavior - WebSocket discovery fails
        if (errorMessage.includes('Session') && errorMessage.includes('not found')) {
          console.log('🐛 BUG REPRODUCED: WebSocket discovery fails even with successful SSH connection');
          console.log('📋 Error details:', errorMessage);
          console.log('🔍 Root cause: ssh_create_session fallback in comprehensive-response-collector.ts line 104');
          
          // This proves the bug exists
          expect(errorMessage).toMatch(/Session.*not found/);
          
          // Fail the test to trigger TDD red phase
          throw new Error(`BUG CONFIRMED: ${errorMessage}`);
          
        } else {
          // Some other error - re-throw for investigation
          console.log('❓ Unexpected error (not the bug we are reproducing):', errorMessage);
          throw error;
        }
      }
    }, 20000);

    it('should have fixed the default fallback command to use ssh_connect', () => {
      // ARRANGE - Create collector with default configuration
      const fixedCollector = new ComprehensiveResponseCollector({
        sessionName: 'test-session'
      });

      // ACT - Get the configuration to examine the fallback
      const config = fixedCollector.getConfig();

      // ASSERT - This verifies the bug fix in line 104
      expect(config.preWebSocketCommands).toBeDefined();
      expect(Array.isArray(config.preWebSocketCommands)).toBe(true);
      
      // The first command should now be ssh_connect (the fix)
      const firstCommand = config.preWebSocketCommands[0];
      expect(firstCommand).toHaveProperty('tool');
      
      // This verifies the fix - should be ssh_connect, not ssh_create_session
      expect(firstCommand.tool).toBe('ssh_connect');
      expect(firstCommand.args).toHaveProperty('name', 'test-session');
      expect(firstCommand.args).toHaveProperty('host', 'localhost');
      expect(firstCommand.args).toHaveProperty('username', 'jsbattig');
      expect(firstCommand.args).toHaveProperty('keyFilePath', '~/.ssh/id_ed25519');
      
      console.log('✅ BUG FIXED: Default fallback now uses correct ssh_connect');
      console.log('📋 Fixed fallback command:', JSON.stringify(firstCommand, null, 2));
    });

    it('should demonstrate proper ssh_connect configuration that should work', async () => {
      // ARRANGE - Manual configuration with correct ssh_connect
      const properConfig = {
        workflowTimeout: 10000,
        sessionName: 'proper-config-test',
        preWebSocketCommands: [
          { 
            tool: 'ssh_connect', 
            args: { 
              name: 'proper-config-test', 
              host: 'localhost', 
              username: 'jsbattig', 
              keyFilePath: '~/.ssh/id_ed25519' 
            } 
          }
        ]
      };

      // ACT - Test pre-WebSocket commands work
      const preWebSocketExecutor = new PreWebSocketCommandExecutor(mcpClient);
      
      try {
        await preWebSocketExecutor.executeCommands(properConfig.preWebSocketCommands);
        console.log('✅ ssh_connect works properly in isolation');
        
        // Now test WebSocket discovery
        const webSocketDiscovery = new WebSocketConnectionDiscovery(mcpClient);
        const webSocketUrl = await webSocketDiscovery.discoverWebSocketUrl('proper-config-test');
        
        console.log('✅ WebSocket discovery works with proper ssh_connect configuration');
        console.log('📡 WebSocket URL:', webSocketUrl);
        
        expect(webSocketUrl).toBeDefined();
        expect(webSocketUrl).toMatch(/^ws:\/\//);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('❌ Even proper configuration fails:', errorMessage);
        
        // This indicates deeper issues beyond just the fallback bug
        throw error;
      } finally {
        await preWebSocketExecutor.cleanup();
      }
    }, 15000);
  });
});