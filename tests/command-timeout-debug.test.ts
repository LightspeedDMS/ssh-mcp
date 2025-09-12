/**
 * Command Timeout Debug Test - TDD Test for Systematic Issue Resolution
 * 
 * PURPOSE: Reproduce and debug the command timeout issue where:
 * - First command works fine
 * - Second command shows results but browser doesn't detect completion
 * - Gets "⚠️ Error: Command timeout" after 30 seconds
 * - Terminal becomes unresponsive
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Command Timeout Debug', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('command-timeout-debug');

  /**
   * FAILING TEST: Reproduce the exact command timeout scenario
   * This test should fail initially, demonstrating the timeout issue
   */
  describe('Command Timeout Issue Reproduction', () => {
    it('should handle sequential commands without timeout errors', async () => {
      // EXPECTATION: Both commands should complete successfully without timeout
      // CURRENT REALITY: Second command times out even though results are visible
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "timeout-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "timeout-test", "command": "pwd"}',
          'ssh_exec {"sessionName": "timeout-test", "command": "whoami"}'
        ],
        workflowTimeout: 45000, // Extended to allow for debug analysis
        sessionName: 'timeout-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // FIRST ASSERTION: Check that we got responses
      expect(result.concatenatedResponses).toBeDefined();
      expect(result.concatenatedResponses.length).toBeGreaterThan(0);

      // SECOND ASSERTION: Check for command completion without timeout
      const responses = result.concatenatedResponses;
      
      // Should contain both command results
      expect(responses).toContain('pwd');
      expect(responses).toContain('whoami');
      
      // Should NOT contain timeout error messages
      expect(responses).not.toContain('Command timeout');
      expect(responses).not.toContain('⚠️ Error: Command timeout');
      
      // Should contain proper prompt completion for both commands
      const promptCount = (responses.match(/\[[^\]]+\]\$/g) || []).length;
      expect(promptCount).toBeGreaterThanOrEqual(2); // At least 2 prompts for command completion
      
    }, 60000); // 60-second Jest timeout to allow for debugging
  });

  /**
   * FAILING TEST: Test prompt detection against actual format
   * This test validates that our regex patterns match the real prompt
   */
  describe('Prompt Detection Validation', () => {
    it('should correctly detect bracket prompt format', () => {
      // CURRENT PROMPT FORMAT: [jsbattig@localhost ~]$
      const actualPromptLine = '[jsbattig@localhost ~]$';
      const promptWithSpacing = '[jsbattig@localhost ls-ssh-mcp]$ ';
      const promptWithPath = '[jsbattig@localhost /home/jsbattig/Dev/ls-ssh-mcp]$';
      
      // Test the regex patterns from terminal-input-handler.ts
      const promptPatterns = [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/, // user@host:path$ 
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/, // user@host:path# (root)
        /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s*[^\]]+\]\$\s*$/, // [user@host project]$ (bracket format)
        /^\[\d{2}:\d{2}:\d{2}\][^$]*\$\s*$/,                // [HH:MM:SS]...$ (with timestamp)
        /^[>]\s*$/                                           // Simple > prompt (minimal)
      ];

      // Test individual patterns
      const bracketPattern = /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s*[^\]]+\]\$\s*$/;
      
      // These should pass for proper prompt detection
      expect(bracketPattern.test(actualPromptLine)).toBe(true);
      expect(bracketPattern.test(promptWithSpacing.trim())).toBe(true);
      expect(bracketPattern.test(promptWithPath)).toBe(true);
      
      // At least one pattern should match each format
      const shouldMatchActual = promptPatterns.some(pattern => pattern.test(actualPromptLine));
      const shouldMatchSpacing = promptPatterns.some(pattern => pattern.test(promptWithSpacing.trim()));
      const shouldMatchPath = promptPatterns.some(pattern => pattern.test(promptWithPath));
      
      expect(shouldMatchActual).toBe(true);
      expect(shouldMatchSpacing).toBe(true);
      expect(shouldMatchPath).toBe(true);
    });

    it('should not falsely detect non-prompt lines as prompts', () => {
      const nonPromptLines = [
        'total 32',
        'drwxrwxr-x 2 jsbattig jsbattig 4096 Jan  1 12:00 src',
        '-rw-rw-r-- 1 jsbattig jsbattig 1234 Jan  1 12:00 package.json',
        'jsbattig',
        '/home/jsbattig/Dev/ls-ssh-mcp',
        'Command completed successfully',
        'Error: Command not found'
      ];

      const promptPatterns = [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/, // user@host:path$ 
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/, // user@host:path# (root)
        /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s*[^\]]+\]\$\s*$/, // [user@host project]$ (bracket format)
        /^\[\d{2}:\d{2}:\d{2}\][^$]*\$\s*$/,                // [HH:MM:SS]...$ (with timestamp)
        /^[>]\s*$/                                           // Simple > prompt (minimal)
      ];

      nonPromptLines.forEach(line => {
        const shouldNotMatch = promptPatterns.some(pattern => pattern.test(line));
        expect(shouldNotMatch).toBe(false);
      });
    });
  });

  /**
   * FAILING TEST: WebSocket Message Analysis
   * This test captures and analyzes WebSocket messages to understand completion detection
   */
  describe('WebSocket Message Analysis', () => {
    it('should analyze WebSocket messages for command completion patterns', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "websocket-analysis", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "websocket-analysis", "command": "echo test-message"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'websocket-analysis'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Analyze the raw responses for debug information
      console.log('=== WEBSOCKET MESSAGE ANALYSIS ===');
      console.log('Full response length:', result.concatenatedResponses.length);
      console.log('Contains CRLF:', result.concatenatedResponses.includes('\r\n'));
      console.log('Response preview:', result.concatenatedResponses.substring(0, 500));
      
      // Look for prompt patterns in the actual response
      const responses = result.concatenatedResponses;
      const promptMatches = responses.match(/\[[^\]]+\]\$/g);
      console.log('Found prompt patterns:', promptMatches);
      
      // Check for command echo and results
      expect(responses).toContain('echo test-message');
      expect(responses).toContain('test-message');
      
      // Should have at least one prompt for command completion
      expect(promptMatches).toBeTruthy();
      expect(promptMatches!.length).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * FAILING TEST: Terminal Lock/Unlock Mechanism Debug
   * This test validates that terminal state management works correctly
   */
  describe('Terminal Lock Mechanism Debug', () => {
    it('should properly manage terminal lock state during command execution', async () => {
      // This test requires manual WebSocket connection to test lock/unlock
      // For now, we'll test the prompt detection logic that drives unlock
      
      const testCases = [
        {
          description: 'Standard bracket prompt',
          input: '[jsbattig@localhost ls-ssh-mcp]$',
          shouldUnlock: true
        },
        {
          description: 'Prompt with trailing space',
          input: '[jsbattig@localhost ~]$ ',
          shouldUnlock: true
        },
        {
          description: 'Command output line',
          input: 'test-message',
          shouldUnlock: false
        },
        {
          description: 'Directory listing line',
          input: 'drwxrwxr-x 2 jsbattig jsbattig 4096 Jan  1 12:00 src',
          shouldUnlock: false
        }
      ];

      testCases.forEach(testCase => {
        // Simulate the isPromptLine logic from terminal-input-handler.ts
        const trimmedOutput = testCase.input.trim();
        const promptPatterns = [
          /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^$]*\$\s*$/, // user@host:path$ 
          /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[~\/][^#]*#\s*$/, // user@host:path# (root)
          /^\[[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\s*[^\]]+\]\$\s*$/, // [user@host project]$ (bracket format)
          /^\[\d{2}:\d{2}:\d{2}\][^$]*\$\s*$/,                // [HH:MM:SS]...$ (with timestamp)
          /^[>]\s*$/                                           // Simple > prompt (minimal)
        ];
        
        const isPrompt = promptPatterns.some(pattern => pattern.test(trimmedOutput));
        
        expect(isPrompt).toBe(testCase.shouldUnlock);
      });
    });
  });
});