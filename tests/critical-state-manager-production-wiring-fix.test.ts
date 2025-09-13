/**
 * CRITICAL STATE MANAGER INTEGRATION TEST
 * 
 * This test demonstrates the production wiring issue where MCP and WebServer components
 * create separate TerminalSessionStateManager instances, making state coordination impossible.
 * 
 * EXPECTED FAILURE: This test will fail before the fix because the components
 * don't share state and commands can execute simultaneously from both paths.
 */

import { MCPSSHServer } from '../src/mcp-ssh-server.js';
import { WebServerManager } from '../src/web-server-manager.js';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { TerminalSessionStateManager } from '../src/terminal-session-state-manager.js';
import WebSocket from 'ws';

describe('CRITICAL: Production State Manager Wiring Fix', () => {
  let sshManager: SSHConnectionManager;
  let sharedStateManager: TerminalSessionStateManager;
  let mcpServer: MCPSSHServer;
  let webServer: WebServerManager;
  let testSessionName: string;
  
  beforeAll(async () => {
    testSessionName = `test-session-${Date.now()}`;
    sshManager = new SSHConnectionManager();
    
    // Create a SINGLE shared state manager (this is the fix)
    sharedStateManager = new TerminalSessionStateManager();
    
    // CRITICAL TEST: Both components must share the SAME state manager instance
    mcpServer = new MCPSSHServer({}, sshManager, sharedStateManager);
    webServer = new WebServerManager(sshManager, {}, sharedStateManager);
    
    // Start web server for WebSocket testing
    await webServer.start();
    
    // Coordinate web server port between components
    const webPort = await webServer.getPort();
    mcpServer.setWebServerPort(webPort);
    sshManager.updateWebServerPort(webPort);
  });
  
  afterAll(async () => {
    await webServer.stop();
    await mcpServer.stop();
    sshManager.cleanup();
  });
  
  beforeEach(async () => {
    // Create test SSH session
    const connectResult = await mcpServer.callTool('ssh_connect', {
      name: testSessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    });
    
    console.log('SSH Connect Result:', JSON.stringify(connectResult, null, 2));
    
    // Verify session was created
    const sessions = await mcpServer.callTool('ssh_list_sessions', {});
    console.log('Available sessions after connect:', JSON.stringify(sessions, null, 2));
  });
  
  afterEach(async () => {
    // Cleanup test session
    try {
      await mcpServer.callTool('ssh_disconnect', { sessionName: testSessionName });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('CRITICAL: MCP and WebServer must share same state manager instance', () => {
    // ASSERTION 1: Both components must have access to the same state manager
    const mcpStateManager = mcpServer.getTerminalStateManager();
    const webStateManager = webServer.getTerminalStateManager();
    
    // CRITICAL: Both components must reference the EXACT same instance
    expect(mcpStateManager).toBeDefined();
    expect(webStateManager).toBeDefined();
    expect(mcpStateManager).toBe(webStateManager);
    expect(mcpStateManager).toBe(sharedStateManager);
  });

  test('CRITICAL: Commands must respect shared session state - no simultaneous execution', async () => {
    // SCENARIO: Start MCP command, then attempt WebSocket command
    // EXPECTED: WebSocket command should be rejected due to busy session
    
    // Start MCP command without awaiting (simulating long-running command)
    const mcpCommandPromise = mcpServer.callTool('ssh_exec', {
      sessionName: testSessionName,
      command: 'sleep 5',
      timeout: 10000
    });
    
    // Keep reference to prevent unused variable warning
    void mcpCommandPromise;
    
    // Give MCP command time to start and acquire session lock
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Attempt WebSocket command on same session - should fail with SESSION_BUSY
    const webPort = await webServer.getPort();
    const wsUrl = `ws://localhost:${webPort}/ws/session/${testSessionName}`;
    
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        // Send terminal input command
        ws.send(JSON.stringify({
          type: 'terminal_input',
          sessionName: testSessionName,
          command: 'whoami',
          commandId: `test-cmd-${Date.now()}`
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'error') {
          // EXPECTED: Should receive SESSION_BUSY error
          expect(message.message).toContain('Session is busy');
          ws.close();
          
          // Cleanup: Cancel the MCP command
          mcpServer.callTool('ssh_cancel_command', { sessionName: testSessionName });
          resolve();
        } else if (message.type === 'terminal_output') {
          // UNEXPECTED: Command executed despite busy session - this is the bug!
          ws.close();
          reject(new Error('CRITICAL BUG: WebSocket command executed despite busy MCP session'));
        }
      });
      
      ws.on('error', (error) => {
        reject(new Error(`WebSocket error: ${error.message}`));
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Test timeout - no response received'));
      }, 3000);
    });
  });

  test('CRITICAL: Resource management pattern - cleanup in finally block', async () => {
    // TEST: Verify that state cleanup happens even if command execution throws
    let stateCleanedUp = false;
    
    // Mock the state manager to verify cleanup
    const originalComplete = sharedStateManager.completeCommandExecution.bind(sharedStateManager);
    sharedStateManager.completeCommandExecution = jest.fn((sessionName: string, commandId: string) => {
      stateCleanedUp = true;
      return originalComplete(sessionName, commandId);
    });
    
    try {
      // Execute command that will fail
      await mcpServer.callTool('ssh_exec', {
        sessionName: testSessionName,
        command: 'invalid-command-that-will-fail',
        timeout: 5000
      });
    } catch (error) {
      // Expected to fail
    }
    
    // CRITICAL: State must be cleaned up even when command fails
    expect(stateCleanedUp).toBe(true);
    expect(sharedStateManager.completeCommandExecution).toHaveBeenCalled();
  });
});