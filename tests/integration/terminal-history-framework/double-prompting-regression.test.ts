/**
 * Double Prompting Regression Test
 *
 * Tests the critical scenario where MCP commands executed after browser commands
 * cause double prompting: [user@host]$ [user@host]$ command instead of [user@host]$ command
 *
 * EVIDENCE FROM USER:
 * [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ date
 * Shows double prompt instead of correct: [jsbattig@localhost ~]$ date
 */

import { JestTestUtilities } from './jest-test-utilities.js';

describe('Double Prompting Regression Prevention', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('double-prompting-regression');

  test('should not double prompt when MCP command follows browser command', async () => {
    const sessionName = 'double-prompt-test';

    const config = {
      preWebSocketCommands: [
        // Establish SSH connection and execute a command to establish terminal state
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}`,
        `ssh_exec {"sessionName": "${sessionName}", "command": "pwd"}`, // First MCP command
      ],
      postWebSocketCommands: [
        // This MCP command after browser activity should NOT double prompt
        `ssh_exec {"sessionName": "${sessionName}", "command": "date"}`,
      ],
      workflowTimeout: 30000,
      sessionName: sessionName
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Extract WebSocket responses to analyze prompting behavior
    const responses = result.concatenatedResponses;

    // Should NOT contain double prompting pattern
    const doublePromptPattern = /\[jsbattig@localhost[^\]]*\]\$\s+\[jsbattig@localhost[^\]]*\]\$\s+date/;
    expect(responses).not.toMatch(doublePromptPattern);

    // Should contain single prompt with date command
    const singlePromptPattern = /\[jsbattig@localhost[^\]]*\]\$\s+date/;
    expect(responses).toMatch(singlePromptPattern);

    // Verify proper command sequence without double prompts
    testUtils.expectWebSocketMessages(responses)
      .toContainCRLF()
      .toHavePrompts()
      .toMatchCommandSequence(['pwd', 'date'])
      .validate();

    // CRITICAL: Ensure no double prompt anywhere in the output
    const promptCount = (responses.match(/\[jsbattig@localhost[^\]]*\]\$/g) || []).length;
    // Should have: initial prompt + pwd command prompt + pwd result prompt + date command prompt + date result prompt
    // Total: 5 prompts maximum, not 6+ from double prompting
    expect(promptCount).toBeLessThanOrEqual(5);

    // Verify date command output is present
    expect(responses).toContain('2025'); // Current year should be in date output

  }, 45000);

  test('should handle multiple MCP commands after browser activity without accumulating prompts', async () => {
    const sessionName = 'multi-mcp-test';

    const config = {
      preWebSocketCommands: [
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}`,
        `ssh_exec {"sessionName": "${sessionName}", "command": "ls", "source": "user"}`, // Simulate browser command
      ],
      postWebSocketCommands: [
        `ssh_exec {"sessionName": "${sessionName}", "command": "whoami"}`,
        `ssh_exec {"sessionName": "${sessionName}", "command": "hostname"}`,
        `ssh_exec {"sessionName": "${sessionName}", "command": "uptime"}`,
      ],
      workflowTimeout: 30000,
      sessionName: sessionName
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    const responses = result.concatenatedResponses;

    // Check for any double prompting patterns
    const doublePromptPatterns = [
      /\[jsbattig@localhost[^\]]*\]\$\s+\[jsbattig@localhost[^\]]*\]\$\s+whoami/,
      /\[jsbattig@localhost[^\]]*\]\$\s+\[jsbattig@localhost[^\]]*\]\$\s+hostname/,
      /\[jsbattig@localhost[^\]]*\]\$\s+\[jsbattig@localhost[^\]]*\]\$\s+uptime/,
    ];

    doublePromptPatterns.forEach((pattern) => {
      expect(responses).not.toMatch(pattern);
    });

    // Verify all commands executed successfully
    expect(responses).toContain('jsbattig'); // whoami output
    expect(responses).toContain('localhost'); // hostname output
    expect(responses).toMatch(/load average/); // uptime output

    // Count total prompts - should be reasonable for 4 commands (ls + whoami + hostname + uptime)
    const promptCount = (responses.match(/\[jsbattig@localhost[^\]]*\]\$/g) || []).length;
    expect(promptCount).toBeLessThanOrEqual(10); // Generous upper bound to catch excessive prompting

  }, 45000);

  test('should maintain proper prompt state when switching between browser and MCP commands', async () => {
    const sessionName = 'mixed-command-test';

    const config = {
      preWebSocketCommands: [
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}`,
        `ssh_exec {"sessionName": "${sessionName}", "command": "echo 'mcp-pre'"}`,
        `ssh_exec {"sessionName": "${sessionName}", "command": "echo 'browser-cmd'", "source": "user"}`, // Simulate browser command
      ],
      postWebSocketCommands: [
        `ssh_exec {"sessionName": "${sessionName}", "command": "echo 'mcp-post'"}`,
      ],
      workflowTimeout: 30000,
      sessionName: sessionName
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    const responses = result.concatenatedResponses;

    // Verify all three commands executed
    expect(responses).toContain('mcp-pre');
    expect(responses).toContain('browser-cmd');
    expect(responses).toContain('mcp-post');

    // Check for double prompting on the post-WebSocket MCP command
    const doublePromptPattern = /\[jsbattig@localhost[^\]]*\]\$\s+\[jsbattig@localhost[^\]]*\]\$\s+echo\s+'mcp-post'/;
    expect(responses).not.toMatch(doublePromptPattern);

    // Verify proper single prompting
    const singlePromptPattern = /\[jsbattig@localhost[^\]]*\]\$\s+echo\s+'mcp-post'/;
    expect(responses).toMatch(singlePromptPattern);

  }, 45000);
});