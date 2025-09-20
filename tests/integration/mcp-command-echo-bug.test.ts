/**
 * CRITICAL BUG TEST: MCP commands missing prompts and command echo
 *
 * This test reproduces the observed behavior where MCP commands like `pwd` and `whoami`
 * show output without proper prompt/command echo formatting:
 *
 * BROKEN: pwd/home/jsbattig
 * EXPECTED: [jsbattig@localhost ~]$ pwd\r\n/home/jsbattig
 */

import { JestTestUtilities } from './terminal-history-framework/jest-test-utilities';

describe('MCP Command Echo Bug Reproduction', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });
    await testUtils.setupTest('mcp-command-echo-bug');
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  test('MCP commands should show proper prompt and command echo', async () => {
    // Configuration for the test scenario
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-bug-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-bug-test", "command": "pwd"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'echo-bug-test'
    };

    // Execute test workflow
    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('Captured WebSocket output:', JSON.stringify(result.concatenatedResponses));

    // THIS TEST SHOULD FAIL INITIALLY - reproducing the broken behavior
    // Current broken output: "pwd/home/jsbattig"
    // Expected correct output should include:
    // 1. Prompt before command: "[jsbattig@localhost ~]$ pwd"
    // 2. Command result: "/home/jsbattig"
    // 3. Ready prompt after: "[jsbattig@localhost ~]$ "

    // Test for proper command echo (this will fail with current broken implementation)
    expect(result.concatenatedResponses).toMatch(/\[.*@.*\s.*\]\$\s+pwd\r\n/);

    // Test for command result separation (this will fail with current broken implementation)
    expect(result.concatenatedResponses).toMatch(/pwd\r\n\/home\/jsbattig/);

    // Test for ready prompt after command (this should work)
    expect(result.concatenatedResponses).toMatch(/\[.*@.*\s.*\]\$\s*$/);
  }, 30000);

  test('Browser commands should continue working correctly (baseline)', async () => {
    // This test ensures that browser commands (Rule 2a/2b/2c) continue working
    // while we fix MCP commands (Rule 3b/3c/3d)

    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "browser-baseline-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        { initiator: 'browser' as const, command: 'ls' }
      ],
      workflowTimeout: 30000,
      sessionName: 'browser-baseline-test'
    };

    // Execute test workflow
    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('Browser command output:', JSON.stringify(result.concatenatedResponses));

    // Browser commands should show proper formatting (baseline test)
    expect(result.concatenatedResponses).toMatch(/\[.*@.*\s.*\]\$\s*ls\r\n/);
  }, 30000);
});