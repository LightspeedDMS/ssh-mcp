/**
 * Debug line ending issues in SSH output
 */

import { SSHConnectionManager } from '../src/ssh-connection-manager.js';

describe('Line Ending Debug', () => {
  let sshManager: SSHConnectionManager;

  beforeEach(() => {
    sshManager = new SSHConnectionManager();
  });

  afterEach(() => {
    if (sshManager) {
      sshManager.cleanup();
    }
  });

  test('Debug SSH output line endings', async () => {
    // Create SSH connection
    const config = {
      name: 'line-debug',
      host: 'localhost',
      username: 'jsbattig',
      keyFilePath: '/home/jsbattig/.ssh/id_ed25519'
    };

    await sshManager.createConnection(config);

    // Capture raw broadcasts
    const broadcasts: Array<{ data: string; source?: string }> = [];
    const originalBroadcast = (sshManager as any).broadcastToLiveListenersRaw;
    (sshManager as any).broadcastToLiveListenersRaw = function(sessionName: string, data: string, source?: string) {
      broadcasts.push({ data, source });
      if (originalBroadcast) {
        originalBroadcast.call(this, sessionName, data, source);
      }
    };

    // Execute a simple command
    const result = await sshManager.executeCommand('line-debug', 'whoami', { source: 'user' });
    console.log('Command result:', result);
    console.log('Stdout chars:', result.stdout.split('').map(c => c === '\r' ? '\\r' : c === '\n' ? '\\n' : c).join(''));

    // Analyze broadcasts
    console.log('\n=== BROADCAST ANALYSIS ===');
    broadcasts.forEach((broadcast, index) => {
      console.log(`\nBroadcast ${index + 1} (source: ${broadcast.source}):`);
      console.log('Raw data:', JSON.stringify(broadcast.data));
      console.log('Character analysis:', broadcast.data.split('').map(c =>
        c === '\r' ? '\\r' :
        c === '\n' ? '\\n' :
        c
      ).join(''));

      // Check for line ending patterns
      const hasOnlyLF = broadcast.data.includes('\n') && !broadcast.data.includes('\r\n');
      const hasOnlyCRLF = broadcast.data.includes('\r\n') && !broadcast.data.replace(/\r\n/g, '').includes('\n');
      const hasMixed = broadcast.data.includes('\r\n') && broadcast.data.replace(/\r\n/g, '').includes('\n');

      console.log('Line ending analysis:');
      console.log(`  - Only LF: ${hasOnlyLF}`);
      console.log(`  - Only CRLF: ${hasOnlyCRLF}`);
      console.log(`  - Mixed: ${hasMixed}`);
    });

    expect(broadcasts.length).toBeGreaterThan(0);
  }, 15000);
});