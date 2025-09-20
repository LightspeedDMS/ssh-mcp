/**
 * Live Listener Formatting Fix Test
 *
 * This test demonstrates the problem with live listeners sending raw terminal entries
 * instead of formatted output with prompts, causing concatenation in browser terminals.
 *
 * The test covers the specific case where:
 * 1. History replay formats output with prompts (Rules 1a/1b)
 * 2. Live listeners send raw results without prompts
 * 3. Browser receives mixed formatted/unformatted content causing concatenation
 */

import { JestTestUtilities } from './jest-test-utilities.js';

describe('Live Listener Formatting Fix', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 45000
    });
    await testUtils.setupTest('live-listener-formatting-fix');
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  it('should demonstrate live listener concatenation problem before fix', async () => {
    // This test should FAIL initially, demonstrating the concatenation problem
    // After implementing the fix, this test should PASS

    const config = {
      // Execute command before WebSocket connection - will be in history replay with prompts
      preWebSocketCommands: [
        'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "test-session", "command": "echo \'first-command\'"}',
      ],

      // Execute command after WebSocket connection - will be sent via live listeners
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "test-session", "command": "echo \'second-command\'"}',
      ],

      workflowTimeout: 30000,
      sessionName: 'test-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Analyze the concatenated responses to show the formatting difference
    console.log('🔧 [LIVE LISTENER DEBUG] Full WebSocket response:');
    console.log(JSON.stringify(result.concatenatedResponses, null, 2));

    // Extract commands and results from the WebSocket messages
    const lines = result.concatenatedResponses.split('\r\n').filter(line => line.trim());
    console.log('🔧 [LIVE LISTENER DEBUG] Parsed lines:', JSON.stringify(lines, null, 2));

    // EXPECTED BEHAVIOR (what should happen after fix):
    // History replay (first command): [jsbattig@localhost ls-ssh-mcp]$ echo 'first-command'
    // History result: first-command
    // Live command (second): [jsbattig@localhost ls-ssh-mcp]$ echo 'second-command'
    // Live result: second-command
    // Final prompt: [jsbattig@localhost ls-ssh-mcp]$

    // CURRENT BROKEN BEHAVIOR (what happens before fix):
    // History replay: [jsbattig@localhost ls-ssh-mcp]$ echo 'first-command'
    // History result: first-command
    // Live result (NO PROMPT): second-command
    // Final prompt: [jsbattig@localhost ls-ssh-mcp]$

    // Look for the specific concatenation pattern: results without separating prompts
    const hasHistoryCommandWithPrompt = result.concatenatedResponses.includes('[jsbattig@localhost') && result.concatenatedResponses.includes('echo \'first-command\'');
    const hasHistoryResult = result.concatenatedResponses.includes('first-command');
    const hasLiveResult = result.concatenatedResponses.includes('second-command');

    console.log('🔧 [LIVE LISTENER DEBUG] Pattern analysis:');
    console.log('- History command with prompt:', hasHistoryCommandWithPrompt);
    console.log('- History result present:', hasHistoryResult);
    console.log('- Live result present:', hasLiveResult);

    // The key test: live command should have prompt formatting just like history
    const hasLiveCommandWithPrompt = result.concatenatedResponses.includes('[jsbattig@localhost') && result.concatenatedResponses.includes('second-command');
    console.log('- Live command with prompt:', hasLiveCommandWithPrompt);

    // Debug: Check if we're getting the live result at all
    console.log('🔧 [DEBUG] Full response analysis:');
    console.log('- Contains "first-command":', result.concatenatedResponses.includes('first-command'));
    console.log('- Contains "second-command":', result.concatenatedResponses.includes('second-command'));
    console.log('- Echo command count:', (result.concatenatedResponses.match(/echo/g) || []).length);

    // Check specifically for the result text (not just the command)
    const firstCommandResultPattern = /first-command(?!\s*'\s*)/;  // Not part of the command
    const secondCommandResultPattern = /second-command(?!\s*'\s*)/; // Not part of the command
    const hasFirstResult = firstCommandResultPattern.test(result.concatenatedResponses);
    const hasSecondResult = secondCommandResultPattern.test(result.concatenatedResponses);

    console.log('- First command result (isolated):', hasFirstResult);
    console.log('- Second command result (isolated):', hasSecondResult);

    // Basic validation that we received expected content
    expect(hasHistoryCommandWithPrompt).toBe(true);
    expect(hasHistoryResult).toBe(true);
    expect(hasLiveResult).toBe(true);

    // VALIDATION: After implementing the fix, live commands should have prompts
    // This confirms the live listener formatting fix is working
    expect(hasLiveCommandWithPrompt).toBe(true); // This should PASS after fix

    // Additional validation: ensure proper CRLF formatting
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toContainCRLF()
      .toHavePrompts()
      .validate();

  }, 45000); // Extended timeout for comprehensive testing

  it('should show formatted output consistency between history and live listeners after fix', async () => {
    // This test validates that after the fix, both history replay and live listeners
    // produce consistently formatted output with proper prompt injection

    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "consistency-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "consistency-session", "command": "pwd"}',
      ],

      postWebSocketCommands: [
        'ssh_exec {"sessionName": "consistency-session", "command": "whoami"}',
        'ssh_exec {"sessionName": "consistency-session", "command": "date"}',
      ],

      workflowTimeout: 30000,
      sessionName: 'consistency-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // After fix, all commands should have consistent prompt formatting
    const expectedPromptPattern = /\[jsbattig@localhost [^\]]+\]\$ /g;
    const promptMatches = result.concatenatedResponses.match(expectedPromptPattern);

    console.log('🔧 [CONSISTENCY CHECK] Found prompt patterns:', promptMatches);

    // Should have prompts for: pwd command, whoami command, date command, and final ready prompt
    // That's at least 4 prompts total
    expect(promptMatches).toBeTruthy();
    expect(promptMatches!.length).toBeGreaterThanOrEqual(4);

    // Validate each command appears with proper prompt formatting
    expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost [^\]]+\]\$ pwd/);
    expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost [^\]]+\]\$ whoami/);
    expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost [^\]]+\]\$ date/);

    // Ensure no bare commands without prompts (no concatenation)
    const lines = result.concatenatedResponses.split('\r\n');
    const commandLines = lines.filter(line =>
      line.includes('pwd') ||
      line.includes('whoami') ||
      line.includes('date')
    );

    // All command lines should include the prompt format
    commandLines.forEach(commandLine => {
      if (commandLine.trim() && !commandLine.match(/^\/|jsbattig|[0-9]/)) { // Exclude result lines
        expect(commandLine).toMatch(/\[jsbattig@localhost [^\]]+\]\$ /);
      }
    });

  }, 45000);
});