/**
 * Debug Broadcast Logs Test
 * 
 * Run a simple test and check the server logs to see broadcast calls
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { CommandConfigurationJSON } from './integration/terminal-history-framework/flexible-command-configuration';

describe('Debug Broadcast Logs', () => {
  test('should run simple command and check broadcast patterns', async () => {
    const testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      testTimeout: 20000
    });
    
    await testUtils.setupTest('broadcast-debug');
    
    try {
      const config: CommandConfigurationJSON = {
        preWebSocketCommands: [
          'ssh_connect {"name": "broadcast-debug", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "broadcast-debug", "command": "echo hi"}',
        ],
        postWebSocketCommands: [],
        workflowTimeout: 15000,
        sessionName: 'broadcast-debug'
      };

      console.log('\n=== RUNNING BROADCAST DEBUG TEST ===');
      console.log('Check server logs for 📡 broadcastToLiveListeners calls');
      
      const result = await testUtils.runTerminalHistoryTest(config);
      
      console.log(`\n=== RESULT ===`);
      console.log(`Success: ${result.success}`);
      console.log(`Messages: "${result.concatenatedResponses}"`);
      
    } finally {
      await testUtils.cleanupTest();
    }
  }, 25000);
});