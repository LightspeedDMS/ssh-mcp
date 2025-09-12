/**
 * Bracket Prompt Format Tests
 * 
 * This test suite validates the SSH prompt format change from:
 * OLD: `jsbattig@localhost:~$`
 * NEW: `[jsbattig@localhost ~]$`
 * 
 * This test suite uses TDD methodology - these tests will fail until
 * the prompt format is implemented in both ssh-connection-manager.ts and web-server-manager.ts
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Bracket Prompt Format Validation', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('bracket-prompt-format');

  describe('New Bracket Format Implementation', () => {
    it('should display prompts in new bracket format [username@host directory]$', async () => {
      // ARRANGE - Test the new bracket format requirement
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-format-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-format-test", "command": "ls"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'bracket-format-test'
      };

      // ACT - Run the terminal history test
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Validate new bracket prompt format
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBeDefined();

      const messages = result.concatenatedResponses;

      // CRITICAL TEST: Must NOT contain old format
      expect(messages).not.toMatch(/jsbattig@localhost:~\$/);
      
      // CRITICAL TEST: Must contain new bracket format
      expect(messages).toMatch(/\[jsbattig@localhost ~\]\$/);

      // Additional validation: Check command and bracket format are both present
      expect(messages).toContain('ls'); // Command should be present
      expect(messages).toMatch(/\[jsbattig@localhost ~\]\$/); // Bracket prompt should be present

      // Framework validation for CRLF and structure
      testUtils.expectWebSocketMessages(messages)
        .toContainCRLF()
        .toHavePrompts()
        .toMatchCommandSequence(['ls'])
        .validate();

      console.log('✅ BRACKET PROMPT FORMAT VALIDATED');
      console.log('📄 Terminal Output Preview:');
      console.log(messages.substring(0, 300) + '...');
    });

    it('should use bracket format in command history replay via WebSocket', async () => {
      // ARRANGE - Test WebSocket history replay with bracket format
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-websocket-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-websocket-test", "command": "pwd"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "bracket-websocket-test", "command": "whoami"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'bracket-websocket-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - WebSocket replay should use bracket format
      expect(result.success).toBe(true);
      const messages = result.concatenatedResponses;

      // OLD FORMAT: Should not exist
      expect(messages).not.toMatch(/jsbattig@localhost:~\$/);
      
      // NEW FORMAT: Should be present throughout the session
      const bracketPromptMatches = messages.match(/\[jsbattig@localhost ~\]\$/g);
      expect(bracketPromptMatches).not.toBeNull();
      expect(bracketPromptMatches!.length).toBeGreaterThanOrEqual(2); // At least 2 prompts for 2 commands

      // Validate commands and bracket prompts are both present
      expect(messages).toContain('pwd'); // pwd command should be present
      expect(messages).toContain('whoami'); // whoami command should be present
      expect(messages).toMatch(/\[jsbattig@localhost ~\]\$/); // Bracket prompt should be present

      console.log('✅ BRACKET FORMAT IN WEBSOCKET REPLAY VALIDATED');
      console.log(`📊 Found ${bracketPromptMatches!.length} bracket prompts in output`);
    });

    it('should handle bracket format correctly with multiple sequential commands', async () => {
      // ARRANGE - Multiple commands to ensure consistent bracket format
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-multiple-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-multiple-test", "command": "echo Command1"}',
          'ssh_exec {"sessionName": "bracket-multiple-test", "command": "echo Command2"}',
          'ssh_exec {"sessionName": "bracket-multiple-test", "command": "echo Command3"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'bracket-multiple-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - All commands should have bracket format
      expect(result.success).toBe(true);
      const messages = result.concatenatedResponses;

      // Count bracket prompts vs old prompts
      const oldPromptCount = (messages.match(/jsbattig@localhost:~\$/g) || []).length;
      const bracketPromptCount = (messages.match(/\[jsbattig@localhost ~\]\$/g) || []).length;

      expect(oldPromptCount).toBe(0); // No old format allowed
      expect(bracketPromptCount).toBeGreaterThanOrEqual(3); // At least 3 bracket prompts

      // Each command should be present along with bracket format
      expect(messages).toContain('echo Command1'); // Command1 should be present
      expect(messages).toContain('echo Command2'); // Command2 should be present  
      expect(messages).toContain('echo Command3'); // Command3 should be present
      expect(bracketPromptCount).toBeGreaterThanOrEqual(3); // Bracket prompts should be present

      // Results should be present too
      expect(messages).toContain('Command1');
      expect(messages).toContain('Command2');
      expect(messages).toContain('Command3');

      console.log('✅ MULTIPLE COMMANDS WITH BRACKET FORMAT VALIDATED');
      console.log(`📊 Bracket prompts: ${bracketPromptCount}, Old prompts: ${oldPromptCount}`);
    });
  });

  describe('Backward Compatibility and Error Handling', () => {
    it('should not break existing functionality with bracket format change', async () => {
      // ARRANGE - Standard functionality test with new format
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-compatibility-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-compatibility-test", "command": "echo Test && pwd"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'bracket-compatibility-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Basic functionality preserved
      expect(result.success).toBe(true);
      const messages = result.concatenatedResponses;

      // CRLF preservation (critical for xterm.js)
      testUtils.expectWebSocketMessages(messages)
        .toContainCRLF()
        .toHavePrompts()
        .validate();

      // Command execution still works
      expect(messages).toContain('Test');
      expect(messages).toContain('/home/jsbattig'); // Should contain current directory path

      // New format is used
      expect(messages).toMatch(/\[jsbattig@localhost ~\]\$/);

      console.log('✅ FUNCTIONALITY COMPATIBILITY WITH BRACKET FORMAT MAINTAINED');
    });
  });

  describe('Prompt Detection Pattern Updates', () => {
    it('should properly detect bracket format prompts in shell initialization', async () => {
      // This test verifies that the detectShellPrompt method works with bracket format
      // We can't directly test the private method, but we can test the overall functionality
      
      // ARRANGE - Simple connection test
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-detection-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "bracket-detection-test", "command": "echo Prompt detection works"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'bracket-detection-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Connection should succeed (meaning prompt detection works)
      expect(result.success).toBe(true);
      const messages = result.concatenatedResponses;

      // Should see the command executed successfully
      expect(messages).toContain('Prompt detection works');

      // Should use bracket format
      expect(messages).toMatch(/\[jsbattig@localhost ~\]\$/);

      console.log('✅ BRACKET PROMPT DETECTION WORKING');
    });
  });

  afterAll(() => {
    console.log('\n📊 BRACKET PROMPT FORMAT VALIDATION SUMMARY:');
    console.log('🎯 Testing prompt format change:');
    console.log('   ❌ OLD: jsbattig@localhost:~$');
    console.log('   ✅ NEW: [jsbattig@localhost ~]$');
    console.log('\n🧪 Test Coverage:');
    console.log('   • Single command with bracket format');
    console.log('   • Multiple commands consistency');
    console.log('   • WebSocket history replay format');
    console.log('   • Backward compatibility verification');
    console.log('   • Shell prompt detection with brackets');
    console.log('\n⚠️  EXPECTED TO FAIL until implementation is complete!');
  });
});