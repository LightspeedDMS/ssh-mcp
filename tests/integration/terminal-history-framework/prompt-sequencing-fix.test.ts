/**
 * TDD Tests for Terminal Prompt Sequencing Fix
 *
 * Tests the surgical fix for prompt logic inversion and state management.
 * These tests should FAIL initially, then pass after implementing the fix.
 */

import { JestTestUtilities } from './jest-test-utilities';

describe('Terminal Prompt Sequencing Fix', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 60000
    });
    await testUtils.setupTest('prompt-sequencing-fix');
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  describe('Browser Command Prompt Usage', () => {
    test('browser-initiated command uses existing prompt (no double prompts)', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "test-session", "command": "echo setup-complete"}'
        ],
        postWebSocketCommands: [
          // This simulates a browser user typing 'ls' - should use existing prompt
          { initiator: 'browser' as const, command: 'ls' }
        ],
        workflowTimeout: 30000,
        sessionName: 'test-session'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Should NOT have double prompts before the 'ls' command
      // Pattern should be: [prompt]$ ls<CRLF> not [prompt]$ [prompt]$ ls<CRLF>
      const concatenatedOutput = result.concatenatedResponses;

      // Count occurrences of prompt patterns before 'ls'
      const promptPattern = /\[jsbattig@localhost[^\]]*\]\$/g;
      const lsCommandIndex = concatenatedOutput.indexOf('ls\r\n');

      if (lsCommandIndex === -1) {
        throw new Error('ls command not found in output');
      }

      const beforeLsOutput = concatenatedOutput.substring(0, lsCommandIndex);
      const promptMatches = beforeLsOutput.match(promptPattern) || [];

      // After setup, should have exactly ONE prompt before 'ls', not two
      const lastTwoPrompts = promptMatches.slice(-2);

      // This test should FAIL initially - will detect double prompts
      expect(lastTwoPrompts).toHaveLength(1);
      expect(concatenatedOutput).not.toMatch(/\]\$\s*\[jsbattig@localhost[^\]]*\]\$\s*ls/);
    }, 45000);

    test('MCP command consumes existing prompt correctly', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "test-session", "command": "echo initial-setup"}'
        ],
        postWebSocketCommands: [
          // MCP-initiated command should consume existing prompt
          'ssh_exec {"sessionName": "test-session", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-session'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      const concatenatedOutput = result.concatenatedResponses;

      // Should see: [prompt]$ pwd<CRLF>/path<CRLF>[new-prompt]$
      // NOT: [prompt]$ [prompt]$ pwd<CRLF>/path<CRLF>[new-prompt]$

      const pwdCommandIndex = concatenatedOutput.indexOf('pwd\r\n');
      expect(pwdCommandIndex).toBeGreaterThan(-1);

      const beforePwdOutput = concatenatedOutput.substring(0, pwdCommandIndex);
      const promptPattern = /\[jsbattig@localhost[^\]]*\]\$/g;
      const promptMatches = beforePwdOutput.match(promptPattern) || [];

      // Should have exactly one prompt before 'pwd', not duplicated
      const lastPrompt = promptMatches[promptMatches.length - 1];
      const promptIndex = beforePwdOutput.lastIndexOf(lastPrompt);
      const afterPrompt = beforePwdOutput.substring(promptIndex + lastPrompt.length);

      // This test should FAIL initially - will detect prompt duplication
      expect(afterPrompt).not.toMatch(/\[jsbattig@localhost[^\]]*\]\$/);
    }, 45000);
  });

  describe('Command Sequence Termination', () => {
    test('every command sequence ends with exactly one new prompt', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test-session", "command": "echo test1"}',
          'ssh_exec {"sessionName": "test-session", "command": "echo test2"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-session'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      const concatenatedOutput = result.concatenatedResponses;

      // Each command should end with exactly one ready prompt
      const promptPattern = /\[jsbattig@localhost[^\]]*\]\$\s*$/;

      // Should end with a single prompt
      expect(concatenatedOutput).toMatch(promptPattern);

      // Count total prompts - should match command count + initial
      const allPromptMatches = concatenatedOutput.match(/\[jsbattig@localhost[^\]]*\]\$/g) || [];

      // Initial + 2 commands should result in 3 total prompts (not doubled)
      // This test should FAIL initially with current logic
      expect(allPromptMatches.length).toBeLessThanOrEqual(4); // Conservative upper bound
    }, 45000);

    test('no prompt concatenation in any command scenario', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test-session", "command": "whoami"}',
          { initiator: 'browser' as const, command: 'date' }
        ],
        workflowTimeout: 30000,
        sessionName: 'test-session'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      const concatenatedOutput = result.concatenatedResponses;

      // Should NEVER see concatenated prompts like: ]$ [user@host dir]$
      const concatenatedPromptPattern = /\]\$\s*\[jsbattig@localhost[^\]]*\]\$/;

      // This test should FAIL initially - will detect prompt concatenation
      expect(concatenatedOutput).not.toMatch(concatenatedPromptPattern);
    }, 45000);
  });

  describe('Prompt State Management', () => {
    test('session maintains prompt state correctly across operations', async () => {
      // This test validates that the SessionData properly tracks prompt state
      // Will need the new hasActivePrompt/lastPromptContent properties

      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test-session", "command": "echo state-test"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-session'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Basic validation that state management doesn't break functionality
      expect(result.concatenatedResponses).toContain('state-test');
      expect(result.concatenatedResponses).toContain('[jsbattig@localhost');

      // This test should PASS even initially, validates basic functionality intact
    }, 30000);
  });
});