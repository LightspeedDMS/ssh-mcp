/**
 * Live WebSocket test - captures what the browser actually receives
 * This tests the real WebSocket flow that browsers use
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { WebServerManager } from '../src/web-server-manager.js';
import WebSocket from 'ws';

describe('Live WebSocket Integration Test', () => {
  let sshManager: SSHConnectionManager;
  let webManager: WebServerManager;
  let port: number;

  beforeEach(async () => {
    sshManager = new SSHConnectionManager();
    webManager = new WebServerManager(sshManager);
    await webManager.start();
    port = await webManager.getPort();
  });

  afterEach(async () => {
    if (webManager) {
      await webManager.stop();
    }
    if (sshManager) {
      sshManager.cleanup();
    }
  });

  test('Real WebSocket flow with actual terminal display data', async () => {
    // Create SSH connection
    const config = {
      name: 'live-test-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    };

    await sshManager.createConnection(config);

    // Connect WebSocket like a real browser
    const wsUrl = `ws://localhost:${port}/ws/session/live-test-session`;
    const ws = new WebSocket(wsUrl);

    const messages: Array<{
      timestamp: number;
      data: any;
      raw: string;
    }> = [];

    // Capture all WebSocket messages
    ws.on('message', (data: Buffer) => {
      const raw = data.toString();
      try {
        const parsed = JSON.parse(raw);
        messages.push({
          timestamp: Date.now(),
          data: parsed,
          raw
        });
      } catch (error) {
        console.error('Failed to parse WebSocket message:', raw);
      }
    });

    // Wait for WebSocket connection
    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // Let initial history load
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n=== INITIAL HISTORY MESSAGES ===');
    messages.forEach((msg, index) => {
      if (msg.data.type === 'terminal_output') {
        console.log(`Message ${index + 1}:`);
        console.log(`  Type: ${msg.data.type}`);
        console.log(`  Source: ${msg.data.source}`);
        console.log(`  Data: ${JSON.stringify(msg.data.data)}`);
        console.log(`  Raw display: ${msg.data.data.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
      }
    });

    // Execute a command via MCP (not WebSocket)
    console.log('\n=== EXECUTING MCP COMMAND: whoami ===');
    const mcpResult = await sshManager.executeCommand('live-test-session', 'whoami', { source: 'claude' });
    console.log('MCP Result:', mcpResult);

    // Wait for WebSocket messages
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Execute a command via WebSocket (simulating browser)
    console.log('\n=== EXECUTING WEBSOCKET COMMAND: pwd ===');
    const commandMessage = {
      type: 'terminal_input',
      sessionName: 'live-test-session',
      command: 'pwd',
      commandId: 'test-cmd-' + Date.now()
    };

    ws.send(JSON.stringify(commandMessage));

    // Wait for command completion
    await new Promise(resolve => setTimeout(resolve, 2000));

    ws.close();

    // Analyze terminal output messages
    const terminalOutputs = messages.filter(msg => msg.data.type === 'terminal_output');

    console.log('\n=== ALL TERMINAL OUTPUT ANALYSIS ===');
    terminalOutputs.forEach((msg, index) => {
      console.log(`\nTerminal Output ${index + 1}:`);
      console.log(`  Source: ${msg.data.source}`);
      console.log(`  Content: ${JSON.stringify(msg.data.data)}`);
      console.log(`  Raw view: ${msg.data.data.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);

      // Check for line ending issues
      const hasInconsistentLineEndings = msg.data.data.includes('\r\n') && msg.data.data.includes('\n') &&
        msg.data.data.replace(/\r\n/g, '').includes('\n');

      if (hasInconsistentLineEndings) {
        console.log(`  ⚠️  INCONSISTENT LINE ENDINGS DETECTED!`);
      }

      // Check for double prompts
      const promptMatches = (msg.data.data.match(/\[jsbattig@localhost[^\]]*\]\$/g) || []);
      if (promptMatches.length > 1) {
        console.log(`  ⚠️  DOUBLE PROMPT DETECTED: ${promptMatches.length} prompts`);
      }

      // Check for missing commands
      if (msg.data.data.includes('[jsbattig@localhost') && !msg.data.data.match(/\]\$\s*[a-zA-Z]/)) {
        console.log(`  ⚠️  MISSING COMMAND AFTER PROMPT`);
      }
    });

    // Concatenate all terminal data as browser would see it
    const browserTerminalView = terminalOutputs
      .map(msg => msg.data.data)
      .join('');

    console.log('\n=== BROWSER TERMINAL VIEW (concatenated) ===');
    console.log('Raw concatenated:', browserTerminalView.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
    console.log('Display view:');
    console.log(browserTerminalView);

    // Check for specific problems
    const issues = [];

    if (browserTerminalView.includes('whoami') && !browserTerminalView.includes('jsbattig')) {
      issues.push('Command executed but result missing');
    }

    if ((browserTerminalView.match(/\[jsbattig@localhost[^\]]*\]\$/g) || []).length > 3) {
      issues.push('Too many prompts (concatenation issue)');
    }

    if (browserTerminalView.includes('\r\n') && browserTerminalView.includes('\n') &&
        browserTerminalView.replace(/\r\n/g, '').includes('\n')) {
      issues.push('Inconsistent line endings (CRLF/LF mixed)');
    }

    console.log('\n=== IDENTIFIED ISSUES ===');
    if (issues.length === 0) {
      console.log('✅ No major issues detected');
    } else {
      issues.forEach((issue, index) => {
        console.log(`❌ Issue ${index + 1}: ${issue}`);
      });
    }

    expect(terminalOutputs.length).toBeGreaterThan(0);
  }, 30000);
});