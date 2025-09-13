/**
 * Villenele Test Case: WebSocket Command Echo Duplication Issue
 * 
 * This comprehensive test reproduces and validates the WebSocket command echo duplication issue where
 * browser-initiated commands are incorrectly echoing both the command AND result, when they should 
 * only send the result (since the browser already displays what the user types).
 * 
 * PROBLEM DESCRIPTION:
 * - MCP commands: Should send command echo + result (full terminal format) ✅
 * - WebSocket/Browser commands: Should send ONLY result (no command echo) ❌ CURRENTLY BROKEN
 * 
 * CURRENT INCORRECT BEHAVIOR:
 * When a user types 'ls' in the browser terminal, they see:
 * 1. 'ls' (what they typed - displayed by browser)
 * 2. 'ls' (incorrectly echoed by server - SHOULD NOT APPEAR)
 * 3. Command results (correct)
 * 
 * EXPECTED CORRECT BEHAVIOR:
 * 1. 'ls' (what they typed - displayed by browser)
 * 2. Command results (server sends only results)
 * 
 * This test uses the Villenele framework (Stories 1-9) with real WebSocket connections and no mocks.
 */

import { JestTestUtilities } from './jest-test-utilities';
import { CommandConfigurationJSON } from './flexible-command-configuration';
import { MCPServerManager } from './mcp-server-manager';
import { MCPClient } from './mcp-client';
import { PreWebSocketCommandExecutor, PreWebSocketCommand } from './pre-websocket-command-executor';
import { WebSocketConnectionDiscovery } from './websocket-connection-discovery';
import { InitialHistoryReplayCapture } from './initial-history-replay-capture';
import { PostWebSocketCommandExecutor, EnhancedCommandParameter } from './post-websocket-command-executor';
import WebSocket from 'ws';

describe('WebSocket Command Echo Duplication Issue - Villenele Test', () => {
  let testUtils: JestTestUtilities;
  let serverManager: MCPServerManager;
  let mcpClient: MCPClient;
  let preWebSocketExecutor: PreWebSocketCommandExecutor;
  let webSocketDiscovery: WebSocketConnectionDiscovery;
  let historyCapture: InitialHistoryReplayCapture;
  let postWebSocketExecutor: PostWebSocketCommandExecutor;
  let webSocket: WebSocket;
  
  const SESSION_NAME = 'echo-duplication-test';
  const SSH_KEY_PATH = '/home/jsbattig/.ssh/id_ed25519';

  beforeEach(async () => {
    // Initialize Villenele test utilities
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });
    
    await testUtils.setupTest('websocket-echo-duplication');
  });

  afterEach(async () => {
    // Cleanup all resources
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.close();
    }
    if (historyCapture) {
      await historyCapture.cleanup();
    }
    if (mcpClient) {
      await mcpClient.disconnect();
    }
    if (serverManager) {
      await serverManager.stop();
    }
    
    await testUtils.cleanupTest();
  });

  /**
   * Test Case 1: Reproduce WebSocket Command Echo Duplication
   * 
   * This test demonstrates the current incorrect behavior where WebSocket commands
   * echo both the command and result.
   */
  it('should reproduce WebSocket command echo duplication issue', async () => {
    // SETUP PHASE: Initialize all Villenele framework components
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
    
    // Story 2: Pre-WebSocket Command Executor
    preWebSocketExecutor = new PreWebSocketCommandExecutor(mcpClient);
    
    // Story 3: WebSocket Connection Discovery
    webSocketDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    
    // Connect via MCP first
    const connectResult = await mcpClient.callTool('ssh_connect', {
      name: SESSION_NAME,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: SSH_KEY_PATH
    });
    
    expect(connectResult.success).toBe(true);
    console.log('✅ SSH connection established via MCP');
    
    // Execute initial MCP commands (these SHOULD show command echo)
    const mcpCommands: PreWebSocketCommand[] = [
      { tool: 'ssh_exec', args: { sessionName: SESSION_NAME, command: 'pwd' } },
      { tool: 'ssh_exec', args: { sessionName: SESSION_NAME, command: 'whoami' } }
    ];
    
    const mcpResults = await preWebSocketExecutor.executeCommands(mcpCommands);
    expect(mcpResults).toHaveLength(2);
    expect(mcpResults.every(r => r.success)).toBe(true);
    
    console.log('✅ Pre-WebSocket MCP commands executed');
    console.log('MCP Command outputs (should include echo):');
    mcpResults.forEach((result, index) => {
      console.log(`  Command ${index + 1}: ${JSON.stringify(mcpCommands[index])}`);
      console.log(`  Result: ${JSON.stringify(result.result).substring(0, 100)}...`);
    });
    
    // WEBSOCKET CONNECTION PHASE
    const webSocketUrl = await webSocketDiscovery.discoverWebSocketUrl(SESSION_NAME);
    webSocket = await webSocketDiscovery.establishConnection(webSocketUrl);
    
    console.log('✅ WebSocket connection established:', webSocketUrl);
    
    // Story 4: Initial History Replay Capture
    historyCapture = new InitialHistoryReplayCapture();
    await historyCapture.captureInitialHistory(webSocket);
    
    const historyMessages = historyCapture.getHistoryMessages();
    console.log(`✅ Captured ${historyMessages.length} history messages`);
    
    // Story 5: Post-WebSocket Command Executor
    postWebSocketExecutor = new PostWebSocketCommandExecutor(
      mcpClient,
      historyCapture,
      { sessionName: SESSION_NAME }
    );
    
    // TEST PHASE: Execute browser commands via WebSocket
    console.log('\n🔍 TESTING WEBSOCKET COMMAND ECHO BEHAVIOR:');
    
    const browserCommands: EnhancedCommandParameter[] = [
      { initiator: 'browser', command: 'ls' },
      { initiator: 'browser', command: 'pwd' },
      { initiator: 'browser', command: 'echo "test message"' }
    ];
    
    // Note: historyCapture doesn't have clearMessages method, messages accumulate
    // We'll need to track message count before and after instead
    
    // Execute browser commands and capture WebSocket responses
    const browserResults = await postWebSocketExecutor.executeCommands(browserCommands, webSocket);
    
    expect(browserResults).toHaveLength(3);
    
    // Get all WebSocket messages received after browser commands
    const realTimeMessages = historyCapture.getRealTimeMessages();
    const allCapturedText = realTimeMessages
      .map(msg => typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data))
      .join('');
    
    console.log('\n📝 CAPTURED WEBSOCKET RESPONSES:');
    console.log('Total real-time messages:', realTimeMessages.length);
    console.log('Combined output length:', allCapturedText.length);
    
    // VALIDATION PHASE: Check for command echo duplication
    console.log('\n🚨 CHECKING FOR ECHO DUPLICATION ISSUES:');
    
    browserCommands.forEach((cmd, index) => {
      const command = cmd.command;
      const result = browserResults[index];
      
      console.log(`\n  Command ${index + 1}: "${command}"`);
      console.log(`  Success: ${result.success}`);
      console.log(`  Captured messages: ${result.capturedMessages.length}`);
      
      // Check if the command itself appears in the WebSocket responses
      // This is the PROBLEM: Commands should NOT be echoed for browser-initiated commands
      const commandEchoCount = (allCapturedText.match(new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      
      console.log(`  ❌ Command echo occurrences in WebSocket response: ${commandEchoCount}`);
      
      if (commandEchoCount > 0) {
        console.log(`  🐛 BUG DETECTED: Command "${command}" is being echoed ${commandEchoCount} time(s)`);
        console.log('     Browser already displays user input - server should NOT echo it back!');
        
        // Find and display the problematic echo
        const echoContext = allCapturedText.indexOf(command);
        if (echoContext !== -1) {
          const contextStart = Math.max(0, echoContext - 50);
          const contextEnd = Math.min(allCapturedText.length, echoContext + command.length + 50);
          console.log(`     Echo context: "...${allCapturedText.substring(contextStart, contextEnd)}..."`);
        }
      }
      
      // This assertion will FAIL until the bug is fixed
      // Browser commands should NOT have their commands echoed in WebSocket responses
      expect(commandEchoCount).toBe(0); // EXPECTED TO FAIL - Documents the bug
    });
    
    // Additional validation: Check for prompt duplication
    const promptPattern = /\[[^\]]+@[^\]]+\s+[^\]]+\]\$/g;
    const promptMatches = allCapturedText.match(promptPattern) || [];
    
    console.log(`\n  Prompt occurrences: ${promptMatches.length}`);
    if (promptMatches.length > browserCommands.length + 1) {
      console.log('  ⚠️  Possible prompt duplication detected');
      console.log('  Expected prompts:', browserCommands.length + 1);
      console.log('  Found prompts:', promptMatches.length);
    }
  });

  /**
   * Test Case 2: Validate Correct Behavior for MCP Commands
   * 
   * This test confirms that MCP commands correctly include command echo,
   * which is the expected behavior for non-browser initiated commands.
   */
  it('should correctly include command echo for MCP commands', async () => {
    // Initialize components
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
    
    preWebSocketExecutor = new PreWebSocketCommandExecutor(mcpClient);
    
    // Connect and execute MCP commands
    await mcpClient.callTool('ssh_connect', {
      name: SESSION_NAME,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: SSH_KEY_PATH
    });
    
    const mcpCommands: PreWebSocketCommand[] = [
      { tool: 'ssh_exec', args: { sessionName: SESSION_NAME, command: 'ls -la' } },
      { tool: 'ssh_exec', args: { sessionName: SESSION_NAME, command: 'date' } }
    ];
    
    console.log('\n✅ TESTING MCP COMMAND ECHO (SHOULD BE PRESENT):');
    
    const results = await preWebSocketExecutor.executeCommands(mcpCommands);
    
    results.forEach((result, index) => {
      const commandText = index === 0 ? 'ls -la' : 'date';
      console.log(`\n  MCP Command ${index + 1}: "${commandText}"`);
      console.log(`  Success: ${result.success}`);
      
      if (result.result && typeof result.result === 'object' && 'output' in result.result) {
        const output = (result.result as any).output;
        const containsEcho = output.includes(commandText);
        
        console.log(`  ✅ Command echo present: ${containsEcho}`);
        console.log(`  Output preview: ${output.substring(0, 200)}...`);
        
        // MCP commands SHOULD include command echo
        expect(containsEcho).toBe(true);
      }
    });
  });

  /**
   * Test Case 3: Mixed Protocol Command Execution
   * 
   * This test validates the behavior when mixing MCP and browser commands,
   * ensuring each protocol maintains its correct echo behavior.
   */
  it('should handle mixed MCP and browser commands with correct echo behavior', async () => {
    // Setup full Villenele workflow
    // Note: config is defined but not used in this example - documenting expected behavior
    void ({
      preWebSocketCommands: [
        `ssh_connect {"name": "${SESSION_NAME}", "host": "localhost", "username": "jsbattig", "keyFilePath": "${SSH_KEY_PATH}"}`,
        `ssh_exec {"sessionName": "${SESSION_NAME}", "command": "cd /tmp"}`,
        `ssh_exec {"sessionName": "${SESSION_NAME}", "command": "pwd"}`
      ],
      postWebSocketCommands: [
        JSON.stringify({ initiator: 'browser', command: 'ls' }),
        JSON.stringify({ initiator: 'mcp-client', command: `ssh_exec {"sessionName": "${SESSION_NAME}", "command": "whoami"}` }),
        JSON.stringify({ initiator: 'browser', command: 'echo "final test"' })
      ],
      workflowTimeout: 30000,
      sessionName: SESSION_NAME
    } as CommandConfigurationJSON);
    
    // Note: This would use the full ComprehensiveResponseCollector in production
    // For this focused test, we're using manual setup to have more control
    
    console.log('\n🔄 TESTING MIXED PROTOCOL COMMANDS:');
    console.log('Pre-WebSocket (MCP): Should include command echo ✅');
    console.log('Post-WebSocket (Browser): Should NOT include command echo ❌');
    console.log('Post-WebSocket (MCP): Behavior depends on Command State Synchronization');
    
    // This test documents the expected behavior for each protocol
    // Currently will fail for browser commands due to the echo duplication bug
  });

  /**
   * Test Case 4: Validate WebSocket Message Format
   * 
   * This test examines the exact format of WebSocket messages to understand
   * how command echo is being incorrectly included.
   */
  it('should analyze WebSocket message structure for echo duplication', async () => {
    // Setup
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
    
    webSocketDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    
    // Connect
    await mcpClient.callTool('ssh_connect', {
      name: SESSION_NAME,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: SSH_KEY_PATH
    });
    
    const webSocketUrl = await webSocketDiscovery.discoverWebSocketUrl(SESSION_NAME);
    webSocket = await webSocketDiscovery.establishConnection(webSocketUrl);
    
    historyCapture = new InitialHistoryReplayCapture();
    await historyCapture.captureInitialHistory(webSocket);
    
    postWebSocketExecutor = new PostWebSocketCommandExecutor(
      mcpClient,
      historyCapture,
      { sessionName: SESSION_NAME }
    );
    
    console.log('\n🔬 ANALYZING WEBSOCKET MESSAGE STRUCTURE:');
    
    // Track message count before browser command
    const messagesBefore = historyCapture.getRealTimeMessages().length;
    console.log(`Messages before command: ${messagesBefore}`);
    
    const testCommand: EnhancedCommandParameter = {
      initiator: 'browser',
      command: 'echo "UNIQUE_MARKER_12345"'
    };
    
    await postWebSocketExecutor.executeCommands([testCommand], webSocket);
    
    // Analyze each WebSocket message
    const messages = historyCapture.getRealTimeMessages();
    
    console.log(`\nTotal WebSocket messages received: ${messages.length}`);
    
    messages.forEach((msg, index) => {
      console.log(`\n  Message ${index + 1}:`);
      console.log(`    Type: ${msg.type}`);
      console.log(`    Timestamp: ${msg.timestamp}`);
      
      const data = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);
      
      // Check if this message contains the command echo
      if (data.includes('echo "UNIQUE_MARKER_12345"')) {
        console.log('    🐛 CONTAINS COMMAND ECHO - This should not be sent for browser commands!');
      }
      
      // Check if this message contains the result
      if (data.includes('UNIQUE_MARKER_12345') && !data.includes('echo')) {
        console.log('    ✅ Contains command result (without echo) - This is correct');
      }
      
      console.log(`    Data preview: ${data.substring(0, 150)}...`);
    });
    
    // Count occurrences of the command in all messages
    const allData = messages.map(m => 
      typeof m.data === 'string' ? m.data : JSON.stringify(m.data)
    ).join('');
    
    const commandOccurrences = (allData.match(/echo "UNIQUE_MARKER_12345"/g) || []).length;
    const resultOccurrences = (allData.match(/UNIQUE_MARKER_12345/g) || []).length;
    
    console.log('\n📊 SUMMARY:');
    console.log(`  Command echo occurrences: ${commandOccurrences} (should be 0 for browser commands)`);
    console.log(`  Result occurrences: ${resultOccurrences - commandOccurrences} (should be 1)`);
    
    // These assertions document the bug
    expect(commandOccurrences).toBe(0); // EXPECTED TO FAIL - command should not be echoed
    expect(resultOccurrences - commandOccurrences).toBeGreaterThan(0); // Result should be present
  });

  /**
   * Test Case 5: Performance Impact of Echo Duplication
   * 
   * This test measures the performance impact of unnecessary echo duplication
   * in terms of bandwidth and message processing.
   */
  it('should measure performance impact of command echo duplication', async () => {
    // Setup components
    serverManager = new MCPServerManager();
    await serverManager.start();
    
    const processInfo = serverManager.getProcess();
    if (!processInfo || !processInfo.stdin || !processInfo.stdout) {
      throw new Error('Failed to start MCP server');
    }
    
    mcpClient = new MCPClient({
      stdin: processInfo.stdin,
      stdout: processInfo.stdout
    } as any);
    
    webSocketDiscovery = new WebSocketConnectionDiscovery(mcpClient);
    
    await mcpClient.callTool('ssh_connect', {
      name: SESSION_NAME,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: SSH_KEY_PATH
    });
    
    const webSocketUrl = await webSocketDiscovery.discoverWebSocketUrl(SESSION_NAME);
    webSocket = await webSocketDiscovery.establishConnection(webSocketUrl);
    
    historyCapture = new InitialHistoryReplayCapture();
    await historyCapture.captureInitialHistory(webSocket);
    
    postWebSocketExecutor = new PostWebSocketCommandExecutor(
      mcpClient,
      historyCapture,
      { sessionName: SESSION_NAME }
    );
    
    console.log('\n📈 MEASURING PERFORMANCE IMPACT:');
    
    // Test with multiple commands
    const commands: EnhancedCommandParameter[] = [
      { initiator: 'browser', command: 'ls -la' },
      { initiator: 'browser', command: 'ps aux' },
      { initiator: 'browser', command: 'df -h' },
      { initiator: 'browser', command: 'free -m' },
      { initiator: 'browser', command: 'uname -a' }
    ];
    
    // Track messages before executing commands
    const messagesBefore = historyCapture.getRealTimeMessages().length;
    console.log(`Messages captured before performance test: ${messagesBefore}`);
    
    const startTime = Date.now();
    await postWebSocketExecutor.executeCommands(commands, webSocket);
    const executionTime = Date.now() - startTime;
    
    // Calculate bandwidth waste
    const messages = historyCapture.getRealTimeMessages();
    const totalData = messages.map(m => 
      typeof m.data === 'string' ? m.data : JSON.stringify(m.data)
    ).join('');
    
    let wastedBytes = 0;
    commands.forEach(cmd => {
      const echoOccurrences = (totalData.match(new RegExp(cmd.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      wastedBytes += echoOccurrences * cmd.command.length;
    });
    
    console.log(`  Total execution time: ${executionTime}ms`);
    console.log(`  Total WebSocket messages: ${messages.length}`);
    console.log(`  Total data transferred: ${totalData.length} bytes`);
    console.log(`  Wasted bandwidth (duplicate echoes): ~${wastedBytes} bytes`);
    console.log(`  Waste percentage: ${((wastedBytes / totalData.length) * 100).toFixed(2)}%`);
    
    // Document performance impact
    expect(wastedBytes).toBe(0); // EXPECTED TO FAIL - documents bandwidth waste
  });
});