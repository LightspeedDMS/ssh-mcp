/**
 * Debug test to reproduce the exact terminal display issue
 * Double prompts, missing commands, broken formatting
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';
import { WebServerManager } from '../src/web-server-manager.js';
import { PortManager } from '../src/port-discovery.js';

describe('Terminal Display Debug', () => {
  let sshManager: SSHConnectionManager;
  let webManager: WebServerManager;
  let portManager: PortManager;

  beforeEach(() => {
    portManager = new PortManager();
    sshManager = new SSHConnectionManager();
    webManager = new WebServerManager(sshManager);
  });

  afterEach(async () => {
    if (webManager) {
      await webManager.stop();
    }
    if (sshManager) {
      sshManager.cleanup();
    }
    if (portManager) {
      portManager.cleanup();
    }
  });

  test('Debug WebSocket broadcast with real SSH connection', async () => {
    // Create real SSH connection to localhost
    const config = {
      name: 'debug-session',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    };

    await sshManager.createConnection(config);

    // Capture WebSocket broadcasts
    const broadcasts: Array<{ timestamp: number; output: string; source?: string }> = [];

    // Mock the broadcast method to capture data
    const originalBroadcast = (sshManager as any).broadcastToLiveListenersRaw;
    (sshManager as any).broadcastToLiveListenersRaw = function(sessionName: string, data: string, source?: string) {
      broadcasts.push({
        timestamp: Date.now(),
        output: data,
        source
      });
      // Call original to maintain functionality
      if (originalBroadcast) {
        originalBroadcast.call(this, sessionName, data, source);
      }
    };

    // Execute commands that show the problem
    console.log('\n=== EXECUTING: whoami ===');
    const result1 = await sshManager.executeCommand('debug-session', 'whoami', { source: 'user' });
    console.log('Command result:', result1);

    console.log('\n=== EXECUTING: pwd ===');
    const result2 = await sshManager.executeCommand('debug-session', 'pwd', { source: 'user' });
    console.log('Command result:', result2);

    console.log('\n=== EXECUTING: ls -la ===');
    const result3 = await sshManager.executeCommand('debug-session', 'ls -la | head -3', { source: 'user' });
    console.log('Command result:', result3);

    // Analyze broadcasts
    console.log('\n=== WEBSOCKET BROADCAST ANALYSIS ===');
    broadcasts.forEach((broadcast, index) => {
      console.log(`\nBroadcast ${index + 1}:`);
      console.log(`Source: ${broadcast.source}`);
      console.log(`Content: ${JSON.stringify(broadcast.output)}`);
      console.log(`Raw view: ${broadcast.output.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
    });

    // Check for double prompts
    const doublePromptIssues = broadcasts.filter(b =>
      b.output.includes('[jsbattig@localhost') &&
      (b.output.match(/\[jsbattig@localhost[^\]]*\]\$/g) || []).length > 1
    );

    console.log('\n=== DOUBLE PROMPT ISSUES ===');
    doublePromptIssues.forEach((issue, index) => {
      console.log(`Issue ${index + 1}: ${issue.output.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
    });

    // Check for missing commands
    const commandEchoIssues = broadcasts.filter(b =>
      b.output.includes('whoami') || b.output.includes('pwd') || b.output.includes('ls -la')
    );

    console.log('\n=== COMMAND ECHO ANALYSIS ===');
    commandEchoIssues.forEach((issue, index) => {
      console.log(`Command Echo ${index + 1}: ${issue.output.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
    });

    // Expected format should be:
    // [jsbattig@localhost ~]$ whoami\r\njsbattig\r\n
    // NOT: [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ \r\n...

    expect(broadcasts.length).toBeGreaterThan(0);
  }, 30000);
});