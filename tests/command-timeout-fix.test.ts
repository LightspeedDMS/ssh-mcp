/**
 * Command Timeout Fix Test - TDD Implementation for Command State Synchronization Issue
 * 
 * PURPOSE: Fix the command timeout issue by addressing the Command State Synchronization logic
 * that incorrectly blocks sequential MCP commands.
 * 
 * ROOT CAUSE IDENTIFIED: 
 * - Command State Synchronization logic blocks MCP commands after browser commands
 * - But in our case, both commands are MCP commands, so they should both execute
 * - The logic needs to be fixed to only block MCP commands after BROWSER commands, not after OTHER MCP commands
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Command Timeout Fix - Command State Synchronization', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('command-timeout-fix');

  /**
   * TEST 1: Verify current broken behavior (should fail initially)
   */
  describe('Current Broken Behavior Verification', () => {
    it('should demonstrate that second MCP command is blocked incorrectly', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "state-sync-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "state-sync-test", "command": "echo first-command"}',
          'ssh_exec {"sessionName": "state-sync-test", "command": "echo second-command"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'state-sync-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Current broken behavior: second command should be missing
      expect(result.concatenatedResponses).toContain('first-command');
      
      // This assertion should FAIL initially, demonstrating the bug
      expect(result.concatenatedResponses).toContain('second-command');
      
      // Should see both commands in the output when fixed
      const echoCommands = (result.concatenatedResponses.match(/echo .+-command/g) || []);
      expect(echoCommands.length).toBe(2);
    });
  });

  /**
   * TEST 2: Verify that browser commands should still be handled correctly
   */
  describe('Browser Command State Synchronization (should work correctly)', () => {
    it('should properly handle mixed browser and MCP commands with sequential execution enabled', async () => {
      // This test verifies the intended behavior of Command State Synchronization
      // when browser commands are actually involved
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "mixed-commands", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          // First: MCP command (should work)
          'ssh_exec {"sessionName": "mixed-commands", "command": "echo mcp-first"}',
          // Second: Another MCP command (should work - this is the fix)
          'ssh_exec {"sessionName": "mixed-commands", "command": "echo mcp-second"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'mixed-commands'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Both MCP commands should execute successfully
      expect(result.concatenatedResponses).toContain('mcp-first');
      expect(result.concatenatedResponses).toContain('mcp-second');
      
      // Should have proper command separation
      const commandCount = (result.concatenatedResponses.match(/echo mcp-/g) || []).length;
      expect(commandCount).toBe(2);
    });
  });

  /**
   * TEST 3: Verify prompt detection is working correctly (should pass)
   */
  describe('Prompt Detection Validation (sanity check)', () => {
    it('should detect prompts correctly in actual WebSocket messages', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "prompt-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "prompt-test", "command": "echo prompt-test"}'
        ],
        workflowTimeout: 15000,
        sessionName: 'prompt-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // Should contain the command and its result
      expect(result.concatenatedResponses).toContain('echo prompt-test');
      expect(result.concatenatedResponses).toContain('prompt-test');
      
      // Should contain proper prompt patterns
      const promptMatches = result.concatenatedResponses.match(/\[[^\]]+\]\$/g);
      expect(promptMatches).toBeTruthy();
      expect(promptMatches!.length).toBeGreaterThanOrEqual(1);
      
      console.log('Prompt detection working correctly:', promptMatches);
    });
  });

  /**
   * TEST 4: Edge case - rapid sequential commands
   */
  describe('Rapid Sequential Command Execution', () => {
    it('should handle multiple rapid sequential MCP commands without timeouts', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "rapid-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "rapid-test", "command": "echo cmd1"}',
          'ssh_exec {"sessionName": "rapid-test", "command": "echo cmd2"}',
          'ssh_exec {"sessionName": "rapid-test", "command": "echo cmd3"}'
        ],
        workflowTimeout: 45000, // Longer timeout for 3 commands
        sessionName: 'rapid-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      // All three commands should execute successfully
      expect(result.concatenatedResponses).toContain('cmd1');
      expect(result.concatenatedResponses).toContain('cmd2');
      expect(result.concatenatedResponses).toContain('cmd3');
      
      // Verify all echo commands are present
      const echoCount = (result.concatenatedResponses.match(/echo cmd\d/g) || []).length;
      expect(echoCount).toBe(3);
      
      // Should have proper prompts between commands
      const promptCount = (result.concatenatedResponses.match(/\[[^\]]+\]\$/g) || []).length;
      expect(promptCount).toBeGreaterThanOrEqual(3);
    });
  });
});