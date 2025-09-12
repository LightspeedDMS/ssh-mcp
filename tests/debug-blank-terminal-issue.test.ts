/**
 * Debug Blank Terminal Issue - Emergency Investigation
 * 
 * This test investigates why the terminal is showing a completely blank screen
 * after implementing the duplicate removal fix.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

const testUtils = JestTestUtilities.setupJestEnvironment('blank-terminal-debug');

describe('Debug Blank Terminal Issue', () => {
  it('should investigate blank terminal with current MCP session', async () => {
    console.log('=== INVESTIGATING BLANK TERMINAL ISSUE ===');
    
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "debug-session", "command": "whoami"}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "debug-session", "command": "pwd"}'}
        ],
      workflowTimeout: 30000,
      sessionName: 'debug-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('Raw concatenated responses:');
    console.log(`"${result.concatenatedResponses}"`);
    console.log('===========================================');
    
    console.log('Response length:', result.concatenatedResponses.length);
    console.log('Contains CRLF:', result.concatenatedResponses.includes('\r\n'));
    console.log('Contains prompts:', result.concatenatedResponses.includes('[jsbattig@localhost'));
    console.log('Contains commands:', result.concatenatedResponses.includes('whoami') || result.concatenatedResponses.includes('pwd'));
    
    // Check if the content is completely empty
    if (result.concatenatedResponses.trim().length === 0) {
      console.log('❌ CRITICAL: Terminal output is completely empty!');
      console.log('This explains the blank screen issue.');
    } else {
      console.log('✅ Content exists, issue might be in WebSocket transmission or browser display');
    }
    
    // Log raw response for analysis
    console.log('Raw response preview (first 200 chars):');
    console.log(JSON.stringify(result.concatenatedResponses.substring(0, 200)));
  });
});