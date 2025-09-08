/**
 * CRITICAL BUG REPRODUCTION TEST: Null Redirection Stray Output
 * 
 * PROBLEM: Terminal output shows unwanted "null 2>&1" line at the beginning
 * Expected: Clean terminal output with no stray system commands
 * Actual: "null 2>&1" appears in terminal history
 * 
 * ROOT CAUSE: PS1 configuration command "export PS1='[\\u@\\h \\W]\\$ ' > /dev/null 2>&1\n"
 * is not working correctly and "null 2>&1" is leaking into terminal output
 * 
 * This test MUST FAIL before the fix and PASS after the fix
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('CRITICAL BUG FIX: Null Redirection Stray Output', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('null-redirection-stray-output-fix');

  test('Terminal output must NOT contain stray "null 2>&1" lines (should PASS after fix)', async () => {
    // Execute simple commands to trigger PS1 initialization and see the stray output
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "test-session", "command": "whoami"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "test-session", "command": "pwd"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'test-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Log the actual output to understand what we're getting
    console.log('DEBUGGING - Raw terminal output:');
    console.log(JSON.stringify(result.concatenatedResponses, null, 2));

    // CRITICAL ASSERTION: The terminal output must NOT contain "null 2>&1"
    expect(result.concatenatedResponses).not.toContain('null 2>&1');

    // ADDITIONAL VERIFICATION: Check that terminal output starts cleanly
    // Should start with proper bracket format prompt, not stray system commands
    const lines = result.concatenatedResponses.split('\r\n').filter(line => line.trim());
    const firstLine = lines[0];
    
    // First line should be a proper prompt or command, NOT a stray system command
    expect(firstLine).not.toMatch(/^null\s+2>&1/);
    expect(firstLine).not.toContain('null 2>&1');

    // POSITIVE ASSERTION: Verify we have proper bracket format prompts
    expect(result.concatenatedResponses).toMatch(/\[[^\]]+@[^\]]+\s+[^\]]+\]\$/);
  }, 35000);

  test('EDGE CASE: Multiple command executions should never leak PS1 configuration', async () => {
    // Execute multiple commands to ensure PS1 config doesn't leak repeatedly
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "multi-test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "multi-test-session", "command": "echo test1"}',
        'ssh_exec {"sessionName": "multi-test-session", "command": "echo test2"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "multi-test-session", "command": "echo test3"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'multi-test-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // CRITICAL: No PS1 configuration traces should appear anywhere in output
    expect(result.concatenatedResponses).not.toContain('export PS1');
    expect(result.concatenatedResponses).not.toContain('null 2>&1');
    expect(result.concatenatedResponses).not.toContain('> /dev/null');

    // Verify clean command execution
    expect(result.concatenatedResponses).toContain('test1');
    expect(result.concatenatedResponses).toContain('test2');
    expect(result.concatenatedResponses).toContain('test3');
  }, 35000);
});