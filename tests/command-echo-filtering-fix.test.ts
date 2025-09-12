/**
 * CRITICAL BUG REPRODUCTION TEST: Command Echo Filtering Failure
 * 
 * This test reproduces the triple output disaster where:
 * 1. Frontend shows typing echo (expected)
 * 2. Server sends command echo (BUG - should be filtered)
 * 3. Server sends result (expected)
 * 4. Server sends full replay (creates triple output)
 * 
 * Expected behavior: WebSocket should contain ONLY the command result,
 * NOT the duplicate command echo.
 * 
 * Uses Villenele framework for real MCP server, SSH, and WebSocket testing.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Command Echo Filtering Bug Reproduction', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('command-echo-filtering-bug');

  beforeAll(async () => {
    // Increase timeout for real MCP/SSH operations
    jest.setTimeout(60000);
  });

  test('should filter out command echo from WebSocket messages - pwd command', async () => {
    // Configuration for testing command echo filtering
    const config = {
      preWebSocketCommands: [
        // Establish SSH connection
        'ssh_connect {"name": "echo-filter-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        // Execute pwd command after WebSocket connection established
        'ssh_exec {"sessionName": "echo-filter-test", "command": "pwd"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'echo-filter-test'
    };

    // Execute test using Villenele framework
    const result = await testUtils.runTerminalHistoryTest(config);

    // Extract the WebSocket response content
    const webSocketMessages = result.concatenatedResponses;
    
    console.log('=== WEBSOCKET MESSAGES DEBUG ===');
    console.log('Full WebSocket content:');
    console.log(JSON.stringify(webSocketMessages, null, 2));
    console.log('Raw WebSocket content:');
    console.log(webSocketMessages);
    console.log('================================');

    // EXACT ASSERTION REQUIREMENTS:
    // 1. WebSocket message should contain the pwd result (e.g., '/home/jsbattig' or similar)
    // 2. WebSocket message should NOT contain duplicate 'pwd' command echo
    // 3. Should not have triple output where command appears multiple times

    // These tests will FAIL initially, proving the bug exists
    
    // Positive assertion: Should contain the command result
    expect(webSocketMessages).toContain('/home/jsbattig');

    // Critical negative assertions: Should NOT contain duplicate command echo
    // Count occurrences of 'pwd' - should appear maximum once in prompt context, not as standalone command echo
    const pwdOccurrences = (webSocketMessages.match(/pwd/g) || []).length;
    console.log(`PWD occurrences found: ${pwdOccurrences}`);
    
    // BUG REPRODUCTION: This will FAIL because command echo is not filtered
    // We should see only 1 occurrence (in prompt), but bug causes multiple occurrences
    expect(pwdOccurrences).toBeLessThanOrEqual(1);

    // Additional exact string assertions to verify no triple output
    // Should not see standalone 'pwd' command echo separate from result
    expect(webSocketMessages).not.toMatch(/^pwd$/m); // No standalone pwd on its own line
    expect(webSocketMessages).not.toMatch(/pwd\r?\n\/home/); // No pwd followed immediately by result
    
    // Should have clean command result output
    expect(webSocketMessages).toMatch(/\/home\/jsbattig/);
  });

  test('should filter out command echo from WebSocket messages - whoami command', async () => {
    // Test with different command to verify filtering works across commands
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-filter-whoami", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-filter-whoami", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'echo-filter-whoami'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    const webSocketMessages = result.concatenatedResponses;
    
    console.log('=== WHOAMI WEBSOCKET DEBUG ===');
    console.log('WebSocket content:');
    console.log(webSocketMessages);
    console.log('==============================');

    // Should contain the whoami result
    expect(webSocketMessages).toContain('jsbattig');

    // Should not contain duplicate whoami command echo
    const whoamiOccurrences = (webSocketMessages.match(/whoami/g) || []).length;
    console.log(`WHOAMI occurrences found: ${whoamiOccurrences}`);
    
    // BUG REPRODUCTION: This will FAIL due to command echo not being filtered
    expect(whoamiOccurrences).toBeLessThanOrEqual(1);

    // No standalone whoami command echo
    expect(webSocketMessages).not.toMatch(/^whoami$/m);
    expect(webSocketMessages).not.toMatch(/whoami\r?\njsbattig/);
  });

  test('should handle multiple commands without echo duplication', async () => {
    // Test sequence of commands to verify consistent filtering
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-filter-multi", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-filter-multi", "command": "pwd"}',
        'ssh_exec {"sessionName": "echo-filter-multi", "command": "whoami"}'
      ],
      workflowTimeout: 45000,
      sessionName: 'echo-filter-multi'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    const webSocketMessages = result.concatenatedResponses;
    
    console.log('=== MULTI-COMMAND WEBSOCKET DEBUG ===');
    console.log('WebSocket content:');
    console.log(webSocketMessages);
    console.log('=====================================');

    // Should contain both command results
    expect(webSocketMessages).toContain('/home/jsbattig');
    expect(webSocketMessages).toContain('jsbattig');

    // Critical: Should not have excessive command echoes
    const pwdOccurrences = (webSocketMessages.match(/pwd/g) || []).length;
    const whoamiOccurrences = (webSocketMessages.match(/whoami/g) || []).length;
    
    console.log(`Multi-command PWD occurrences: ${pwdOccurrences}`);
    console.log(`Multi-command WHOAMI occurrences: ${whoamiOccurrences}`);

    // BUG REPRODUCTION: These will FAIL due to unfiltered command echoes
    expect(pwdOccurrences).toBeLessThanOrEqual(2); // At most in prompts
    expect(whoamiOccurrences).toBeLessThanOrEqual(2); // At most in prompts
  });
});