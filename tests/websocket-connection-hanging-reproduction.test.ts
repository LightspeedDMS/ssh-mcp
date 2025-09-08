/**
 * WebSocket Connection Hanging Issue Reproduction Test
 * 
 * This test reproduces the issue where WebSocket connections hang during initialization,
 * causing browsers to display "⚠️ Message Error" instead of a working terminal.
 * 
 * Test Scenario:
 * 1. Create SSH session "debug-session"
 * 2. Start web server on discovered port
 * 3. Attempt WebSocket connection to session endpoint
 * 4. Verify connection establishes without hanging
 * 5. Verify proper terminal history is sent
 * 
 * Expected Behavior:
 * - WebSocket connects successfully
 * - Initial terminal history is sent to browser
 * - No "⚠️ Message Error" appears
 * 
 * Current Failing Behavior:
 * - WebSocket handshake hangs indefinitely
 * - Browser timeout results in "⚠️ Message Error"
 * - No terminal history received
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import WebSocket from 'ws';

describe('WebSocket Connection Hanging Issue Reproduction', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('websocket-hanging-repro');
  let webSocketUrl: string;
  let sessionName: string;

  beforeEach(async () => {
    sessionName = 'debug-session';
  });

  test('SHOULD connect WebSocket without hanging - reproduces current failure', async () => {
    // This test will use the comprehensive testing framework to establish SSH session
    // and then extract the WebSocket URL for direct WebSocket connection testing
    
    const { ComprehensiveResponseCollector } = await import('./integration/terminal-history-framework/comprehensive-response-collector');
    const { FlexibleCommandConfiguration } = await import('./integration/terminal-history-framework/flexible-command-configuration');
    const { MCPServerManager } = await import('./integration/terminal-history-framework/mcp-server-manager');
    const { MCPClient } = await import('./integration/terminal-history-framework/mcp-client');
    const { WebSocketConnectionDiscovery } = await import('./integration/terminal-history-framework/websocket-connection-discovery');
    const { PreWebSocketCommandExecutor } = await import('./integration/terminal-history-framework/pre-websocket-command-executor');
    const { InitialHistoryReplayCapture } = await import('./integration/terminal-history-framework/initial-history-replay-capture');
    const { PostWebSocketCommandExecutor } = await import('./integration/terminal-history-framework/post-websocket-command-executor');
    
    // STEP 1: Set up comprehensive framework components manually for testing
    const commandConfig = new FlexibleCommandConfiguration({
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "debug-session", "command": "pwd"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 15000,
      sessionName: sessionName
    });
    
    const collectorConfig = commandConfig.getComprehensiveResponseCollectorConfig();
    const responseCollector = new ComprehensiveResponseCollector(collectorConfig);
    
    // Initialize all framework components
    const mcpServerManager = new MCPServerManager();
    await mcpServerManager.start();
    const serverProcess = mcpServerManager.getRawProcess();
    if (!serverProcess) {
      throw new Error('Failed to get MCP server process');
    }
    
    const mcpClient = new MCPClient(serverProcess);
    const preWebSocketExecutor = new PreWebSocketCommandExecutor(mcpClient);
    const webSocketConnectionDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    const initialHistoryReplayCapture = new InitialHistoryReplayCapture();
    const postWebSocketCommandExecutor = new PostWebSocketCommandExecutor(mcpClient);
    
    // Inject all components into response collector
    responseCollector.setServerManager(mcpServerManager);
    responseCollector.setMcpClient(mcpClient);
    responseCollector.setPreWebSocketExecutor(preWebSocketExecutor);
    responseCollector.setConnectionDiscovery(webSocketConnectionDiscovery);
    responseCollector.setHistoryCapture(initialHistoryReplayCapture);
    responseCollector.setPostWebSocketExecutor(postWebSocketCommandExecutor);
    
    // Variables to track WebSocket connection state
    let webSocketError: Error | undefined = undefined;
    let connectionEstablished = false;
    let messagesReceived: string[] = [];
    
    try {
      // STEP 2: Execute pre-WebSocket commands to establish SSH session
      await preWebSocketExecutor.executeCommands(collectorConfig.preWebSocketCommands || []);
      
      // STEP 3: Discover WebSocket URL using the established session
      webSocketUrl = await webSocketConnectionDiscovery.discoverWebSocketUrl(sessionName);
      console.log(`[TEST] Attempting WebSocket connection to: ${webSocketUrl}`);

      // STEP 4: Attempt WebSocket connection with timeout to detect hanging
      const connectionTimeout = 10000; // 10 seconds should be enough for handshake
      const websocket = new WebSocket(webSocketUrl);
      
      // Set up connection timeout
      const timeoutHandle = setTimeout(() => {
        if (!connectionEstablished) {
          webSocketError = new Error(`WebSocket connection timed out after ${connectionTimeout}ms - connection is hanging`);
          websocket.terminate();
        }
      }, connectionTimeout);

      // Promise that resolves when connection establishes or fails
      await new Promise<void>((resolve, reject) => {
        websocket.on('open', () => {
          clearTimeout(timeoutHandle);
          connectionEstablished = true;
          console.log('[TEST] WebSocket connection established successfully');
          resolve();
        });

        websocket.on('message', (data: Buffer) => {
          const messageText = data.toString();
          messagesReceived.push(messageText);
          console.log(`[TEST] Received WebSocket message: ${messageText.slice(0, 100)}...`);
          
          // Debug: Check if this specific message contains CRLF
          try {
            const parsedMessage = JSON.parse(messageText);
            if (parsedMessage.type === 'terminal_output' && parsedMessage.data) {
              const dataContent = parsedMessage.data;
              const hasCRLF = dataContent.includes('\r\n');
              const hasLF = dataContent.includes('\n');
              console.log(`[TEST] Message data CRLF: ${hasCRLF}, LF: ${hasLF}, content: ${JSON.stringify(dataContent.slice(0, 50))}`);
            }
          } catch (e) {
            // Ignore JSON parse errors for debug
          }
        });

        websocket.on('error', (error) => {
          clearTimeout(timeoutHandle);
          webSocketError = error instanceof Error ? error : new Error(String(error));
          reject(webSocketError);
        });

        websocket.on('close', () => {
          clearTimeout(timeoutHandle);
          if (!connectionEstablished && !webSocketError) {
            const closeError = new Error('WebSocket closed before connection was established');
            webSocketError = closeError;
            reject(closeError);
          }
          resolve();
        });
      });

      // STEP 5: Verify connection established without hanging
      expect(connectionEstablished).toBe(true);
      expect(webSocketError).toBeUndefined();

      // STEP 6: Verify initial terminal history was sent
      // Wait a moment for history replay messages
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(messagesReceived.length).toBeGreaterThan(0);

      // Verify terminal history contains expected SSH session content
      const allMessages = messagesReceived.join('');
      console.log('[TEST] ALL MESSAGES CRLF CHECK:', JSON.stringify(allMessages.slice(0, 200)));
      console.log('[TEST] ALL MESSAGES HAS CRLF:', allMessages.includes('\r\n'));
      
      // Extract just the terminal data from messages for CRLF checking
      const terminalData = messagesReceived
        .map(msg => {
          try {
            const parsed = JSON.parse(msg);
            return parsed.type === 'terminal_output' ? parsed.data : '';
          } catch {
            return '';
          }
        })
        .join('');
      
      console.log('[TEST] TERMINAL DATA CRLF CHECK:', JSON.stringify(terminalData.slice(0, 200)));
      console.log('[TEST] TERMINAL DATA HAS CRLF:', terminalData.includes('\r\n'));
      
      testUtils.expectWebSocketMessages(terminalData)
        .toContainCRLF()
        .toHavePrompts()
        .toMatchCommandSequence(['pwd'])
        .toHaveMinimumLength(50)
        .validate();

      websocket.close();

    } catch (error) {
      // This test is EXPECTED TO FAIL initially - we're reproducing the issue
      console.error(`[TEST] WebSocket connection failed as expected:`, error);
      
      // Document the exact failure for debugging
      console.error(`[TEST] WebSocket connection failed as expected:`, webSocketError, error);
      
      // The WebSocket connection is actually working! The issue was incorrect test expectations.
      // The error we're catching is actually from test assertions, not connection failures.
      console.log('[TEST] The error caught is from test assertions, not WebSocket connectivity issues');
      
      // Re-throw the assertion error to show what the real issue was
      throw error;
    } finally {
      // Always cleanup the MCP server
      try {
        await mcpServerManager.stop();
      } catch (cleanupError) {
        console.warn('[TEST] Error during cleanup:', cleanupError);
      }
    }
  }, 25000); // 25 second timeout for this test

  test('SHOULD handle WebSocket URL construction correctly', async () => {
    // Test WebSocket URL construction logic separately
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 10000,
      sessionName: sessionName
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    expect(result.success).toBe(true);

    // Use WebSocket connection discovery to get the actual URL
    const { MCPServerManager } = await import('./integration/terminal-history-framework/mcp-server-manager');
    const { MCPClient } = await import('./integration/terminal-history-framework/mcp-client');
    const { WebSocketConnectionDiscovery } = await import('./integration/terminal-history-framework/websocket-connection-discovery');
    
    const serverManager = new MCPServerManager();
    await serverManager.start();
    const serverProcess = serverManager.getRawProcess();
    if (!serverProcess) {
      throw new Error('Failed to get MCP server process for URL construction test');
    }
    
    const mcpClient = new MCPClient(serverProcess);
    const connectionDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    
    let webSocketUrl: string;
    try {
      webSocketUrl = await connectionDiscovery.discoverWebSocketUrl(sessionName);
    } finally {
      await serverManager.stop();
    }
    
    // Parse the URL to get port
    const urlParts = new URL(webSocketUrl);
    const webPort = parseInt(urlParts.port);
    expect(webPort).toBeGreaterThan(0);
    expect(webPort).toBeLessThan(65536);
    
    // Verify URL format is correct
    console.log(`[TEST] Discovered WebSocket URL: ${webSocketUrl}`);
    expect(webSocketUrl).toMatch(/^ws:\/\/localhost:\d+\/ws\/session\/debug-session$/);
  });
});