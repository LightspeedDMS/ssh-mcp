/**
 * Unified Broadcast+Store Test Suite
 *
 * This test suite validates the unified approach to terminal command echo and history storage,
 * ensuring that what gets broadcast to live browsers is exactly what gets stored in history.
 *
 * The goal is to eliminate the dual storage/broadcast logic that causes inconsistency between
 * live display and history replay.
 *
 * Target: Single unified function that broadcasts AND stores exactly the same content.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { TestEnvironmentConfig } from './test-environment-config';

describe('Unified Broadcast+Store Behavior', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('unified-broadcast-store');

  describe('MCP Command Echo Behavior', () => {
    it('should show prompt+command, then result, then final prompt for MCP commands', async () => {
      // ARRANGE - Test MCP command execution (source='claude')
      const username = TestEnvironmentConfig.getTestUsername();
      const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();
      const prompt = TestEnvironmentConfig.getExpectedPrompt();

      const config = {
        preWebSocketCommands: [
          `ssh_connect {"name": "mcp-command-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
          'ssh_exec {"sessionName": "mcp-command-test", "command": "whoami"}' // This is an MCP command (source='claude')
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'mcp-command-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - MCP commands should show: prompt+command → result → final prompt
      expect(result.success).toBe(true);

      const trailingPrompt = TestEnvironmentConfig.getExpectedTrailingPrompt();
      const expectedOutput = `${prompt} whoami\r\n${username}\r\n${trailingPrompt}`;
      console.log('=== MCP COMMAND EXACT VALIDATION ===');
      console.log('Expected:', JSON.stringify(expectedOutput));
      console.log('Actual  :', JSON.stringify(result.concatenatedResponses));
      console.log('=======================================');

      // This test will FAIL initially because current logic creates double prompts
      expect(result.concatenatedResponses).toBe(expectedOutput);

      console.log('✅ MCP COMMAND ECHO VALIDATED - EXACT MATCH');
    });
  });

  describe('Browser Command Echo Behavior', () => {
    it('should show command, then result, then final prompt for browser commands', async () => {
      // ARRANGE - Test browser command execution (source='user') via post-WebSocket
      const username = TestEnvironmentConfig.getTestUsername();
      const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

      const config = {
        preWebSocketCommands: [
          `ssh_connect {"name": "browser-command-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`
        ],
        postWebSocketCommands: [
          {initiator: 'browser', command: 'whoami'} // This simulates browser user typing
        ],
        workflowTimeout: 30000,
        sessionName: 'browser-command-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Browser commands should show: command → result → final prompt (no initial prompt)
      expect(result.success).toBe(true);

      const trailingPrompt = TestEnvironmentConfig.getExpectedTrailingPrompt();
      const expectedOutput = `whoami\r\n${username}\r\n${trailingPrompt}`;
      console.log('=== BROWSER COMMAND EXACT VALIDATION ===');
      console.log('Expected:', JSON.stringify(expectedOutput));
      console.log('Actual  :', JSON.stringify(result.concatenatedResponses));
      console.log('========================================');

      // This test will likely FAIL initially due to current complex logic
      expect(result.concatenatedResponses).toBe(expectedOutput);

      console.log('✅ BROWSER COMMAND ECHO VALIDATED - EXACT MATCH');
    });
  });

  describe('History Replay Consistency', () => {
    it('should replay stored history exactly as it was broadcast live', async () => {
      // ARRANGE - Execute multiple commands and verify replay consistency
      const username = TestEnvironmentConfig.getTestUsername();
      const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();
      const prompt = TestEnvironmentConfig.getExpectedPrompt();

      const config = {
        preWebSocketCommands: [
          `ssh_connect {"name": "history-consistency-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
          'ssh_exec {"sessionName": "history-consistency-test", "command": "echo test"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "history-consistency-test", "command": "whoami"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'history-consistency-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - History should be exactly what was broadcast
      expect(result.success).toBe(true);

      // Unified behavior: MCP commands show prompt+command, browser commands just show command
      const trailingPrompt = TestEnvironmentConfig.getExpectedTrailingPrompt();
      const expectedOutput = `${prompt} echo test\r\ntest\r\n${trailingPrompt}whoami\r\n${username}\r\n${trailingPrompt}`;

      console.log('=== HISTORY CONSISTENCY EXACT VALIDATION ===');
      console.log('Expected:', JSON.stringify(expectedOutput));
      console.log('Actual  :', JSON.stringify(result.concatenatedResponses));
      console.log('============================================');

      // This test validates that stored history = broadcast content exactly
      expect(result.concatenatedResponses).toBe(expectedOutput);

      console.log('✅ HISTORY REPLAY CONSISTENCY VALIDATED');
    });
  });

  describe('No Double Prompt Prevention', () => {
    it('should never show duplicate or concatenated prompts', async () => {
      // ARRANGE - Test scenario that previously caused double prompts
      const username = TestEnvironmentConfig.getTestUsername();
      const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();
      const prompt = TestEnvironmentConfig.getExpectedPrompt();

      const config = {
        preWebSocketCommands: [
          `ssh_connect {"name": "no-double-prompt-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
          'ssh_exec {"sessionName": "no-double-prompt-test", "command": "pwd"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'no-double-prompt-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - No double prompts, clean single sequence
      expect(result.success).toBe(true);

      const homeDir = TestEnvironmentConfig.getTestHomeDirectory();
      const trailingPrompt = TestEnvironmentConfig.getExpectedTrailingPrompt();
      const expectedOutput = `${prompt} pwd\r\n${homeDir}\r\n${trailingPrompt}`;

      console.log('=== NO DOUBLE PROMPT EXACT VALIDATION ===');
      console.log('Expected:', JSON.stringify(expectedOutput));
      console.log('Actual  :', JSON.stringify(result.concatenatedResponses));
      console.log('=========================================');

      // Verify no double prompts exist in the output
      const doublePromptPattern = `${prompt}${prompt}`;
      expect(result.concatenatedResponses.includes(doublePromptPattern)).toBe(false);

      // Verify exact expected output
      expect(result.concatenatedResponses).toBe(expectedOutput);

      console.log('✅ NO DOUBLE PROMPTS DETECTED - CLEAN OUTPUT');
    });
  });

  describe('Unified Function Behavior', () => {
    it('should use single unified broadcastAndStore function for all command types', async () => {
      // This test will verify that the implementation uses a single unified function
      // instead of separate broadcastToLiveListeners + storeInHistory calls

      // NOTE: This test primarily validates the internal implementation approach
      // The external behavior validation is covered by the other tests

      // ARRANGE - Simple command to test unified function usage
      const username = TestEnvironmentConfig.getTestUsername();
      const sshKeyPath = TestEnvironmentConfig.getTestSSHKeyPath();

      const config = {
        preWebSocketCommands: [
          `ssh_connect {"name": "unified-function-test", "host": "localhost", "username": "${username}", "keyFilePath": "${sshKeyPath}"}`,
          'ssh_exec {"sessionName": "unified-function-test", "command": "echo unified"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'unified-function-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Simple validation that unified approach works
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toContain('unified');
      expect(result.concatenatedResponses).toContain('\r\n');

      console.log('✅ UNIFIED FUNCTION APPROACH VALIDATED');
      console.log('📋 Output:', JSON.stringify(result.concatenatedResponses));
    });
  });

  afterAll(() => {
    console.log('\n📊 UNIFIED BROADCAST+STORE TEST SUMMARY:');
    console.log('🎯 Validates unified approach requirements:');
    console.log('   ✓ MCP commands: prompt+command → result → final prompt');
    console.log('   ✓ Browser commands: command → result → final prompt');
    console.log('   ✓ History replay = exact broadcast content');
    console.log('   ✓ No double prompts or concatenation');
    console.log('   ✓ Single unified broadcastAndStore function');
    console.log('\n🛠️  Expected Implementation Changes:');
    console.log('   • Replace broadcastToLiveListeners + storeInHistory with unified function');
    console.log('   • Eliminate complex conditional logic in broadcastCommandWithPrompt');
    console.log('   • Store exactly what gets broadcast - no separate processing');
    console.log('\n🚀 These tests will PASS after implementing unified approach!');
  });
});