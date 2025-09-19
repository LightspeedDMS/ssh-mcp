/**
 * Missing Command Echo Fix - TDD Test Suite
 *
 * This test suite demonstrates and fixes the missing command echo problem
 * where commands executed via MCP show only results but not the command itself.
 *
 * PROBLEM: Terminal history shows:
 * [jsbattig@localhost ~]$ /home/jsbattig     # Missing "pwd" command
 * [jsbattig@localhost ~]$ jsbattig          # Missing "whoami" command
 *
 * EXPECTED: Terminal history should show:
 * [jsbattig@localhost ~]$ pwd
 * /home/jsbattig
 * [jsbattig@localhost ~]$ whoami
 * jsbattig
 *
 * CRITICAL: These tests should FAIL before the fix and PASS after implementation
 */

import { JestTestUtilities } from './jest-test-utilities';

describe('Missing Command Echo Fix', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });
    await testUtils.setupTest('missing-command-echo-fix');
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  describe('Command Echo Missing Problem', () => {
    /**
     * This test demonstrates the current broken behavior where commands are missing
     * EXPECTED TO FAIL before fix implementation
     */
    test('FAILING: pwd command should appear in terminal history before its result', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "pwd-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "pwd-echo-test", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'pwd-echo-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('Current terminal output (shows the problem):');
      console.log(result.concatenatedResponses);

      // The command 'pwd' should appear in the terminal history
      expect(result.concatenatedResponses).toContain('pwd');

      // The command should appear BEFORE its result
      const pwdIndex = result.concatenatedResponses.indexOf('pwd');
      const resultIndex = result.concatenatedResponses.indexOf('/home/jsbattig');

      expect(pwdIndex).toBeGreaterThan(-1);
      expect(resultIndex).toBeGreaterThan(-1);
      expect(pwdIndex).toBeLessThan(resultIndex);

      // The terminal should show proper format: [user@host dir]$ command\r\nresult
      expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost [^\]]+\]\$\s*pwd\s*\r\n[^\r\n]*\/home\/jsbattig/);
    });

    /**
     * Test multiple commands to show the scope of the problem
     * EXPECTED TO FAIL before fix implementation
     */
    test('FAILING: Multiple commands should show proper command echo format', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "multi-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "multi-echo-test", "command": "pwd"}',
          'ssh_exec {"sessionName": "multi-echo-test", "command": "whoami"}',
          'ssh_exec {"sessionName": "multi-echo-test", "command": "echo test-command"}'
        ],
        workflowTimeout: 45000,
        sessionName: 'multi-echo-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('Multiple commands terminal output (shows the problem):');
      console.log(result.concatenatedResponses);

      // Each command should appear in the terminal history
      expect(result.concatenatedResponses).toContain('pwd');
      expect(result.concatenatedResponses).toContain('whoami');
      expect(result.concatenatedResponses).toContain('echo test-command');

      // Results should also be present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      expect(result.concatenatedResponses).toContain('jsbattig');
      expect(result.concatenatedResponses).toContain('test-command');

      // Commands should appear before their results in natural terminal session format
      const lines = result.concatenatedResponses.split('\r\n');

      // Find pwd command and its result
      const pwdCommandLineIndex = lines.findIndex(line => line.includes('pwd') && line.includes('$'));
      const pwdResultLineIndex = lines.findIndex(line => line.includes('/home/jsbattig') && !line.includes('$'));

      expect(pwdCommandLineIndex).toBeGreaterThan(-1);
      expect(pwdResultLineIndex).toBeGreaterThan(-1);
      expect(pwdCommandLineIndex).toBeLessThan(pwdResultLineIndex);
    });

    /**
     * Test that verifies the current broken format vs expected format
     * EXPECTED TO FAIL before fix implementation
     */
    test('FAILING: Terminal history should show complete session format with command echoes', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "session-format-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "session-format-test", "command": "whoami"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'session-format-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('Session format test output (current broken format):');
      console.log(JSON.stringify(result.concatenatedResponses));

      // Expected terminal session format: [user@host dir]$ command\r\nresult\r\n[user@host dir]$
      // The complete session should show the command being typed, not just the result

      // This regex should match the expected format where command appears after prompt
      const expectedSessionFormat = /\[jsbattig@localhost [^\]]+\]\$\s*whoami\s*\r\n[^\r\n]*jsbattig/;
      expect(result.concatenatedResponses).toMatch(expectedSessionFormat);

      // The terminal output should NOT just show results without commands
      // Current broken format: [user@host dir]$ jsbattig (missing "whoami" command)
      // Expected format: [user@host dir]$ whoami\r\njsbattig
      const brokenFormat = /\[jsbattig@localhost [^\]]+\]\$\s*jsbattig/;
      expect(result.concatenatedResponses).not.toMatch(brokenFormat);
    });
  });

  describe('Command Echo Fix Validation', () => {
    /**
     * After implementing the fix, this test should pass
     * Tests that commands are properly stored with echo in terminal history
     */
    test('SHOULD PASS AFTER FIX: Commands are stored with proper echo format in TerminalOutputEntry', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "fixed-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "fixed-echo-test", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'fixed-echo-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // After the fix, terminal history should contain command echo
      expect(result.concatenatedResponses).toContain('pwd');
      expect(result.concatenatedResponses).toContain('/home/jsbattig');

      // Verify proper session format: command appears before result
      const sessionFormat = /\[jsbattig@localhost [^\]]+\]\$\s*pwd\s*\r\n[^\r\n]*\/home\/jsbattig/;
      expect(result.concatenatedResponses).toMatch(sessionFormat);

      // Ensure we don't have the broken format (result without command)
      const brokenFormat = /\[jsbattig@localhost [^\]]+\]\$\s*\/home\/jsbattig/;
      expect(result.concatenatedResponses).not.toMatch(brokenFormat);
    });

    /**
     * Comprehensive test after fix implementation
     */
    test('SHOULD PASS AFTER FIX: Multiple commands show natural terminal session flow', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "complete-fix-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "complete-fix-test", "command": "pwd"}',
          'ssh_exec {"sessionName": "complete-fix-test", "command": "whoami"}',
          'ssh_exec {"sessionName": "complete-fix-test", "command": "echo test-complete"}'
        ],
        workflowTimeout: 45000,
        sessionName: 'complete-fix-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Each command should be echoed properly
      expect(result.concatenatedResponses).toContain('pwd');
      expect(result.concatenatedResponses).toContain('whoami');
      expect(result.concatenatedResponses).toContain('echo test-complete');

      // Each result should be present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      expect(result.concatenatedResponses).toContain('jsbattig');
      expect(result.concatenatedResponses).toContain('test-complete');

      // Terminal should show natural interactive session format
      // Expected flow: prompt + command + result + prompt + command + result...
      const lines = result.concatenatedResponses.split('\r\n');

      // Verify each command appears before its result
      const pwdCommandIndex = lines.findIndex(line => line.includes('pwd') && line.includes('$'));
      const pwdResultIndex = lines.findIndex((line, index) =>
        index > pwdCommandIndex && line.includes('/home/jsbattig') && !line.includes('$')
      );

      expect(pwdCommandIndex).toBeGreaterThan(-1);
      expect(pwdResultIndex).toBeGreaterThan(-1);
      expect(pwdCommandIndex).toBeLessThan(pwdResultIndex);
    });
  });
});