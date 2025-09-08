/**
 * SSH Server Echo Management Test
 * 
 * This test validates that SSH PTY is configured to disable server echo,
 * preventing character duplication when browsers send character-by-character input.
 * 
 * CRITICAL ISSUE: SSH servers naturally echo characters back to the client,
 * causing double display when browsers send individual keystrokes via WebSocket.
 * 
 * Required Fix: Configure SSH PTY with ECHO disabled and manage echo modes per session.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';

describe('SSH Server Echo Management', () => {
  let sshManager: SSHConnectionManager;
  let mcpProcess: ChildProcess;
  let testSessionName: string;
  let webSocketPort: number;

  beforeAll(async () => {
    // Start MCP server process for testing
    mcpProcess = spawn('npm', ['start'], {
      cwd: '/home/jsbattig/Dev/ls-ssh-mcp',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for MCP server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP server failed to start within timeout'));
      }, 10000);

      mcpProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP Server listening on')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      mcpProcess.stderr?.on('data', (data) => {
        console.error('MCP server error:', data.toString());
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Initialize SSH connection manager
    sshManager = new SSHConnectionManager(8080);
    webSocketPort = 8080;
  }, 30000);

  afterAll(async () => {
    // Clean up test session
    if (sshManager && testSessionName && sshManager.hasSession(testSessionName)) {
      await sshManager.disconnectSession(testSessionName);
    }

    // Terminate MCP process
    if (mcpProcess) {
      mcpProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        mcpProcess.on('exit', () => resolve());
        setTimeout(() => {
          mcpProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }, 15000);

  beforeEach(() => {
    testSessionName = `final-validation-${Date.now()}`;
  });

  afterEach(async () => {
    if (sshManager && testSessionName && sshManager.hasSession(testSessionName)) {
      await sshManager.disconnectSession(testSessionName);
    }
  });

  test('should configure SSH PTY with ECHO disabled to prevent server-side character duplication', async () => {
    // FAILING TEST: This will fail because SSH PTY currently uses default echo settings
    
    // Create SSH connection with echo management test session
    const connection = await sshManager.createConnection({
      name: testSessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });

    expect(connection.status).toBe('connected');

    // Connect to WebSocket monitoring endpoint
    const wsUrl = `ws://localhost:${webSocketPort}/session/${testSessionName}`;
    const ws = new WebSocket(wsUrl);

    const webSocketMessages: string[] = [];

    ws.on('open', () => {
      console.log('WebSocket connected for echo management test');
    });

    ws.on('message', (data) => {
      const message = data.toString();
      webSocketMessages.push(message);
      console.log('WebSocket received:', JSON.stringify(message));
    });

    // Wait for initial connection and prompt
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (webSocketMessages.some(msg => msg.includes('$') || msg.includes('#') || msg.includes('>'))) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    console.log('Initial WebSocket messages:', webSocketMessages);

    // Clear previous messages to focus on character input test
    webSocketMessages.length = 0;

    // TEST CASE: Send character-by-character input via terminal_input_raw
    const testCharacters = ['h', 'e', 'l', 'l', 'o'];
    
    for (const char of testCharacters) {
      // Send individual character like real browser would
      sshManager.sendTerminalInput(testSessionName, char);
      
      // Small delay to allow processing
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Send Enter to complete the command
    sshManager.sendTerminalInput(testSessionName, '\n');

    // Wait for command completion and response
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const lastMessage = webSocketMessages[webSocketMessages.length - 1] || '';
        if (lastMessage.includes('$') || lastMessage.includes('#') || lastMessage.includes('>')) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });

    ws.close();

    console.log('Character input WebSocket messages:', webSocketMessages);

    // CRITICAL ASSERTION: Verify no character duplication from server echo
    const concatenatedOutput = webSocketMessages.join('');
    
    // This test should FAIL initially because SSH server echo is enabled
    // Expected behavior: Each character should appear only once in terminal output
    // Actual behavior: Each character appears twice due to server echo
    
    // Count occurrences of each test character in the output
    const characterCounts = testCharacters.reduce((counts, char) => {
      const occurrences = (concatenatedOutput.match(new RegExp(char, 'g')) || []).length;
      counts[char] = occurrences;
      return counts;
    }, {} as Record<string, number>);

    console.log('Character occurrence counts:', characterCounts);

    // EXPECTED FAILURE: This assertion should fail showing double characters
    // After fix: Each character should appear exactly once (no server echo)
    testCharacters.forEach(char => {
      expect(characterCounts[char]).toBe(1); // This will fail - shows server echo issue
    });

    // Additional assertion: No double character sequences in output
    testCharacters.forEach(char => {
      const doubleChar = char + char;
      expect(concatenatedOutput).not.toContain(doubleChar);
    });

    // Verify the complete word appears correctly without duplication
    expect(concatenatedOutput).toMatch(/hello/); // Should appear once, not "hheelllloo"

  }, 30000);

  test('should track raw input mode per session and manage echo appropriately', async () => {
    // FAILING TEST: This will fail because raw input mode tracking is not implemented
    
    const connection = await sshManager.createConnection({
      name: testSessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });

    expect(connection.status).toBe('connected');

    // Test that session can switch between echo modes
    // Raw input mode: ECHO disabled
    // Normal input mode: ECHO enabled (for backward compatibility)
    
    // This test will fail because the session tracking is not implemented
    // The fix should add session state to track input modes
    
    // For now, this is a placeholder test that will fail
    // Implementation should add:
    // 1. Session state tracking for input modes
    // 2. PTY reconfiguration methods
    // 3. Mode switching based on input type (terminal_input_raw vs terminal_input)
    
    expect(true).toBe(false); // Intentional failure until implementation
    
  }, 10000);

  test('should demonstrate current SSH server echo problem', async () => {
    // DEMONSTRATION TEST: Shows the current problem with server echo
    
    const connection = await sshManager.createConnection({
      name: testSessionName,
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '~/.ssh/id_ed25519'
    });

    expect(connection.status).toBe('connected');

    const wsUrl = `ws://localhost:${webSocketPort}/session/${testSessionName}`;
    const ws = new WebSocket(wsUrl);

    const webSocketMessages: string[] = [];

    ws.on('message', (data) => {
      webSocketMessages.push(data.toString());
    });

    // Wait for initial prompt
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (webSocketMessages.some(msg => msg.includes('$') || msg.includes('#') || msg.includes('>'))) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });

    // Clear messages for clean test
    webSocketMessages.length = 0;

    // Send single character 'x'
    sshManager.sendTerminalInput(testSessionName, 'x');
    
    // Wait a moment for echo
    await new Promise(resolve => setTimeout(resolve, 200));

    ws.close();

    const output = webSocketMessages.join('');
    console.log('Single character test output:', JSON.stringify(output));

    // DEMONSTRATION: This will likely show the character appears twice
    // Once from browser input, once from SSH server echo
    const xCount = (output.match(/x/g) || []).length;
    console.log('Character "x" appears', xCount, 'times in output');

    // Document the current behavior (this may pass showing the problem)
    expect(xCount).toBeGreaterThan(0);
    
  }, 15000);
});