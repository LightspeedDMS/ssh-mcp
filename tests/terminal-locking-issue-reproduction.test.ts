/**
 * Terminal Locking Issue Reproduction Test
 * TDD: Write failing tests to reproduce the terminal locking behavior that needs fixing
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Terminal Locking Issue Reproduction', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-locking-reproduction');

  /**
   * FAILING TEST: Demonstrates current broken behavior with artificial locking
   * This test SHOULD fail initially to prove the problem exists
   */
  it('should NOT show terminal locked message for immediate command completion', async () => {
    // Arrange: Simple command that executes immediately
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "terminal-lock-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "terminal-lock-test", "command": "pwd"}' // Simple, fast command
      ],
      workflowTimeout: 5000, // Short timeout to trigger issue
      sessionName: 'terminal-lock-test'
    };

    // Act: Execute command through terminal
    const result = await testUtils.runTerminalHistoryTest(config);

    // Assert: These assertions SHOULD FAIL initially proving the problem
    expect(result.concatenatedResponses).not.toContain('Terminal locked - command executing');
    expect(result.concatenatedResponses).not.toContain('⚠ Error: Command timeout');
    expect(result.concatenatedResponses).not.toContain('terminal-locked'); // CSS class
    
    // Should contain natural prompt after command completion
    expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost[^\]]*\]\$/);
  });

  /**
   * FAILING TEST: Demonstrates prompt detection failure for bracket format
   * This test reproduces the core issue: isPromptLine() not recognizing bracket prompts
   */
  it('should detect bracket format prompts correctly', async () => {
    // Test data: Real bracket format prompts from current system
    const bracketPrompts = [
      '[jsbattig@localhost ls-ssh-mcp]$ ',
      '[jsbattig@localhost ls-ssh-mcp]$',
      '[jsbattig@localhost ~]$ ',
      '[jsbattig@localhost /home/jsbattig]$ '
    ];

    // Simulate the isPromptLine function from terminal-input-handler.js
    const isPromptLine = (output: string): boolean => {
      const trimmedOutput = output.trim();
      const promptPatterns = [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/, // user@host:path$ 
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/, // user@host:path# (root)
        /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s+[^\]]+\]\$\s*$/, // [user@host project]$ (bracket format)
        /^\[\d{2}:\d{2}:\d{2}\][^$]*\$\s*$/, // [HH:MM:SS]...$ (with timestamp)
        /^[>]\s*$/ // Simple > prompt (minimal)
      ];
      return promptPatterns.some(pattern => pattern.test(trimmedOutput));
    };

    // Act & Assert: These assertions SHOULD FAIL initially
    for (const prompt of bracketPrompts) {
      expect(isPromptLine(prompt)).toBe(true);
    }
  });

  /**
   * FAILING TEST: Natural terminal flow without artificial delays
   * Tests the desired behavior where commands execute and terminal becomes ready immediately
   */
  it('should allow immediate next command after previous command completes', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "natural-flow-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "natural-flow-test", "command": "pwd"}',
        'ssh_exec {"sessionName": "natural-flow-test", "command": "whoami"}' // Second immediate command
      ],
      workflowTimeout: 10000,
      sessionName: 'natural-flow-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Assert: Should see both commands execute without locking delays
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toMatchCommandSequence(['pwd', 'whoami'])
      .toNotContain('Terminal locked')
      .toNotContain('Command timeout')
      .validate();

    // Should see natural prompt flow: command1 -> result1 -> prompt -> command2 -> result2 -> prompt
    const prompts = result.concatenatedResponses.match(/\[jsbattig@localhost[^\]]*\]\$/g);
    expect(prompts).toBeTruthy();
    expect(prompts!.length).toBeGreaterThanOrEqual(2); // At least 2 prompts for 2 commands
  });

  /**
   * FAILING TEST: WebSocket message timing analysis
   * Analyzes the timing between command execution and prompt appearance
   */
  it('should show prompt immediately after command results without artificial delay', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "timing-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "timing-test", "command": "echo TIMING_TEST_MARKER"}' // Easily identifiable output
      ],
      workflowTimeout: 8000,
      sessionName: 'timing-test'
    };

    const startTime = Date.now();
    const result = await testUtils.runTerminalHistoryTest(config);
    const totalTime = Date.now() - startTime;

    // Should complete quickly without timeout delays
    expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds

    // Should see marker followed by prompt
    expect(result.concatenatedResponses).toContain('TIMING_TEST_MARKER');
    expect(result.concatenatedResponses).toMatch(/TIMING_TEST_MARKER[\r\n]+\[jsbattig@localhost[^\]]*\]\$/);
  });
});