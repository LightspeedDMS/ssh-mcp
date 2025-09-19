/**
 * ELITE TDD TEST SUITE - Double Echo Root Cause Fix
 *
 * This test suite proves the architectural issue with double echo
 * and validates the production-grade fix that eliminates the root cause
 * rather than applying regex band-aids.
 *
 * ROOT CAUSE: Commands from WebSocket (source='user') are echoed TWICE:
 * 1. By broadcastCommandWithPrompt in ssh-connection-manager.ts
 * 2. By the SSH PTY itself (natural terminal echo)
 *
 * ELITE SOLUTION: Remove the duplicate echo at the source - don't echo
 * user commands in broadcastCommandWithPrompt since PTY handles it.
 */

import { describe, it, expect } from '@jest/globals';
import { JestTestUtilities } from './jest-test-utilities';
import type { CommandConfigurationJSON } from './flexible-command-configuration';

describe('ELITE Echo Fix - Root Cause Elimination', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('elite-echo-fix');

  /**
   * TEST 1: Prove the double echo problem exists
   * This test should FAIL initially, proving the architectural issue
   */
  it('should show double echo problem with current implementation', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-test", "command": "echo hello"}'
      ],
      workflowTimeout: 15000,
      sessionName: 'echo-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Debug: Let's see what we actually get
    console.log('=== ACTUAL OUTPUT ===');
    console.log(result.concatenatedResponses);
    console.log('=== END OUTPUT ===');

    // Count how many times "echo hello" appears in the output
    const echoCount = (result.concatenatedResponses.match(/echo hello/g) || []).length;
    console.log(`Found "echo hello" ${echoCount} times`);

    // Look for the missing space between prompt and command
    const missingSpacePattern = /\]\$echo hello/;
    const hasMissingSpace = missingSpacePattern.test(result.concatenatedResponses);
    console.log(`Has missing space between prompt and command: ${hasMissingSpace}`);

    // FAILING ASSERTION: The regex processing is removing the duplicate echo
    // but causing the space issue. There should be a space between prompt and command
    expect(hasMissingSpace).toBe(false);

    // The output should contain the result
    expect(result.concatenatedResponses).toContain('hello');
  }, 30000);

  /**
   * TEST 2: Validate commands with arguments aren't duplicated
   */
  it('should not duplicate commands with arguments', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "args-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "args-test", "command": "ls -la /tmp"}'
      ],
      workflowTimeout: 15000,
      sessionName: 'args-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Count occurrences of the full command
    const commandCount = (result.concatenatedResponses.match(/ls -la \/tmp/g) || []).length;

    // Should see the command only once (from PTY echo)
    expect(commandCount).toBe(1);
  }, 30000);

  /**
   * TEST 3: Validate commands with special characters
   */
  it('should handle commands with quotes and special characters correctly', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "special-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "special-test", "command": "echo \\"Hello World!\\""}'
      ],
      workflowTimeout: 15000,
      sessionName: 'special-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Count occurrences - should be exactly 1
    const commandCount = (result.concatenatedResponses.match(/echo "Hello World!"/g) || []).length;
    expect(commandCount).toBe(1);

    // Output should contain the result
    expect(result.concatenatedResponses).toContain('Hello World!');
  }, 30000);

  /**
   * TEST 4: Rapid command sequence performance test
   * Validates no performance degradation with multiple commands
   */
  it('should handle rapid command sequences without duplication or performance issues', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "perf-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "perf-test", "command": "pwd"}',
        'ssh_exec {"sessionName": "perf-test", "command": "whoami"}',
        'ssh_exec {"sessionName": "perf-test", "command": "date"}',
        'ssh_exec {"sessionName": "perf-test", "command": "hostname"}',
        'ssh_exec {"sessionName": "perf-test", "command": "uptime"}'
      ],
      workflowTimeout: 20000,
      sessionName: 'perf-test'
    };

    const startTime = Date.now();
    const result = await testUtils.runTerminalHistoryTest(config);
    const executionTime = Date.now() - startTime;

    // Each command should appear exactly once
    const commands = ['pwd', 'whoami', 'date', 'hostname', 'uptime'];
    for (const cmd of commands) {
      const count = (result.concatenatedResponses.match(new RegExp(`\\b${cmd}\\b`, 'g')) || []).length;
      expect(count).toBe(1);
    }

    // Performance check - should complete rapidly (under 10 seconds for 5 commands)
    expect(executionTime).toBeLessThan(10000);
  }, 30000);

  /**
   * TEST 5: MCP commands (source='claude') should still show prompt + command
   * This validates that MCP command formatting remains intact
   */
  it('should preserve MCP command echo with prompt formatting', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "mcp-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "mcp-test", "command": "pwd"}'  // MCP command
      ],
      postWebSocketCommands: [],  // No WebSocket commands
      workflowTimeout: 15000,
      sessionName: 'mcp-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // MCP commands should show with prompt formatting
    // Pattern: [username@hostname dir]$ command
    const promptCommandPattern = /\[jsbattig@localhost[^\]]*\]\$ pwd/;
    expect(result.concatenatedResponses).toMatch(promptCommandPattern);
  }, 30000);

  /**
   * TEST 6: Validate no regex processing in output path
   * This test ensures the fix removes all regex band-aids
   */
  it('should not apply any regex transformations to output', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "regex-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        // Command with patterns that regex might match
        'ssh_exec {"sessionName": "regex-test", "command": "echo pwd whoami ls cd"}'
      ],
      workflowTimeout: 15000,
      sessionName: 'regex-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // All these words should appear in the output unchanged
    expect(result.concatenatedResponses).toContain('pwd whoami ls cd');

    // The echo command itself should appear only once
    const echoCount = (result.concatenatedResponses.match(/echo pwd whoami ls cd/g) || []).length;
    expect(echoCount).toBe(1);
  }, 30000);
});