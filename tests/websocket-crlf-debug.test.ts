/**
 * Debug test to specifically examine WebSocket message content and CRLF handling
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('WebSocket CRLF Debug', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('websocket-crlf-debug');

  test('Examine raw WebSocket message content for CRLF presence', async () => {
    // Create SSH session and run a simple command
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "debug-session", "command": "echo hello"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 15000,
      sessionName: 'debug-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    expect(result.success).toBe(true);

    console.log('=== RAW CONCATENATED RESPONSES ===');
    console.log('Length:', result.concatenatedResponses.length);
    console.log('Content (first 500 chars):');
    console.log(JSON.stringify(result.concatenatedResponses.slice(0, 500)));
    
    console.log('\n=== CRLF ANALYSIS ===');
    const hasCRLF = result.concatenatedResponses.includes('\r\n');
    const hasLF = result.concatenatedResponses.includes('\n');
    const hasCR = result.concatenatedResponses.includes('\r');
    
    console.log('Contains CRLF (\\r\\n):', hasCRLF);
    console.log('Contains LF (\\n):', hasLF);  
    console.log('Contains CR (\\r):', hasCR);
    
    // Count occurrences
    const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
    const lfCount = (result.concatenatedResponses.match(/(?<!\r)\n/g) || []).length;
    const crCount = (result.concatenatedResponses.match(/\r(?!\n)/g) || []).length;
    
    console.log('CRLF count:', crlfCount);
    console.log('Standalone LF count:', lfCount);
    console.log('Standalone CR count:', crCount);
    
    console.log('\n=== CHARACTER-BY-CHARACTER ANALYSIS (first 200) ===');
    for (let i = 0; i < Math.min(200, result.concatenatedResponses.length); i++) {
      const char = result.concatenatedResponses[i];
      const code = char.charCodeAt(0);
      if (code === 13) {
        console.log(`[${i}] CR (\\r)`);
      } else if (code === 10) {
        console.log(`[${i}] LF (\\n)`);
      } else if (code < 32 || code > 126) {
        console.log(`[${i}] ${code} (${char.charCodeAt(0).toString(16)})`);
      }
    }
  });
});