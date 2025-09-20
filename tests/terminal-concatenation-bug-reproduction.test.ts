import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('Terminal Concatenation Bug Reproduction', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-concatenation-bug');

  test('should reproduce terminal output concatenation bug', async () => {
    // Test configuration to reproduce the concatenation bug
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "concatenation-test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "concatenation-test-session", "command": "pwd"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "concatenation-test-session", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'concatenation-test-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('🔍 DEBUGGING: WebSocket output for concatenation analysis:');
    console.log('---START RAW OUTPUT---');
    console.log(result.concatenatedResponses);
    console.log('---END RAW OUTPUT---');

    // THIS TEST SHOULD FAIL INITIALLY - proving concatenation bug exists

    // 1. Assert proper CRLF line endings exist
    const hasCRLF = result.concatenatedResponses.includes('\r\n');
    console.log(`📋 Has CRLF (\\r\\n): ${hasCRLF}`);
    expect(hasCRLF).toBe(true); // Should FAIL initially

    // 2. Assert command echo and result are on separate lines
    const lines = result.concatenatedResponses.split('\r\n');
    console.log(`📋 Total lines: ${lines.length}`);
    console.log(`📋 Lines:`, lines);

    // Look for command echo pattern: [user@host dir]$ command
    const commandEchoPattern = /\[.*@.*\s+.*\]\$\s+pwd/;
    const hasCommandEcho = lines.some(line => commandEchoPattern.test(line));
    console.log(`📋 Has command echo pattern: ${hasCommandEcho}`);
    expect(hasCommandEcho).toBe(true); // Should FAIL initially

    // 3. Assert that command result appears on separate line after prompt
    const hasCommandResult = lines.some(line => line.includes('/home/jsbattig'));
    console.log(`📋 Has command result: ${hasCommandResult}`);
    expect(hasCommandResult).toBe(true);

    // 4. Assert no concatenation - command and result should NOT be on same line
    const concatenatedPattern = /pwd\/home\/jsbattig/; // This indicates concatenation bug
    const hasConcatenation = result.concatenatedResponses.match(concatenatedPattern);
    console.log(`📋 Has concatenation bug: ${!!hasConcatenation}`);
    expect(hasConcatenation).toBe(null); // Should FAIL initially - bug exists

    // 5. Assert proper prompt separation
    const promptPattern = /\[.*@.*\s+.*\]\$/;
    const promptMatches = result.concatenatedResponses.match(new RegExp(promptPattern.source, 'g'));
    console.log(`📋 Prompt matches: ${promptMatches?.length || 0}`);
    expect(promptMatches).toBeDefined();
    expect(promptMatches!.length).toBeGreaterThan(1); // Should have multiple prompts

    // 6. Verify overall formatting quality
    const properlyFormatted = hasCRLF && hasCommandEcho && !hasConcatenation;
    console.log(`📋 Overall formatting quality: ${properlyFormatted}`);
    expect(properlyFormatted).toBe(true); // Should FAIL initially

  }, 60000);

  test('should validate WebSocket message structure preserves CRLF', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "websocket-crlf-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "websocket-crlf-test", "command": "echo test-message"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 20000,
      sessionName: 'websocket-crlf-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('🔍 DEBUGGING: WebSocket CRLF analysis:');
    console.log('---START WEBSOCKET OUTPUT---');
    console.log(JSON.stringify(result.concatenatedResponses, null, 2));
    console.log('---END WEBSOCKET OUTPUT---');

    // Check for specific CRLF preservation
    const bytes = Buffer.from(result.concatenatedResponses, 'utf8');
    const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
    const lfOnlyCount = (result.concatenatedResponses.match(/(?<!\r)\n/g) || []).length;

    console.log(`📋 CRLF count: ${crlfCount}`);
    console.log(`📋 LF-only count: ${lfOnlyCount}`);
    console.log(`📋 Byte analysis:`, bytes.slice(0, 100));

    // THIS SHOULD FAIL - proving CRLF is being lost in WebSocket transmission
    expect(crlfCount).toBeGreaterThan(0); // Should FAIL initially
    expect(lfOnlyCount).toBe(0); // Should FAIL initially - LF-only indicates lost CR

  }, 30000);
});