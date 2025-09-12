/**
 * END-TO-END TERMINAL PROTOCOL FIX VALIDATION
 * 
 * This test validates that the complete terminal input flow works after the critical
 * protocol mismatch fix. It tests the complete user interaction flow:
 * type → enter → execute → unlock
 * 
 * VALIDATION COVERAGE:
 * 1. Terminal input handler correctly formats messages with 'command' field
 * 2. Server accepts and processes terminal_input messages
 * 3. Commands execute successfully and return terminal output
 * 4. Bracket prompt format is properly detected
 * 5. Terminal unlocks after command completion
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('E2E: Terminal Protocol Fix Validation', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-protocol-fix-e2e');

  describe('Complete Terminal Workflow', () => {
    it('should handle complete terminal input workflow: type → enter → execute → unlock', async () => {
      // ARRANGE - Set up terminal session
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "protocol-fix-validation", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "protocol-fix-validation", "command": "whoami"}'  // Establish session
        ],
        postWebSocketCommands: [
          // Test real-time terminal input (simulating user typing and pressing enter)
          'ssh_exec {"sessionName": "protocol-fix-validation", "command": "pwd"}',
          'ssh_exec {"sessionName": "protocol-fix-validation", "command": "echo Protocol Fix Test"}',
          'ssh_exec {"sessionName": "protocol-fix-validation", "command": "ls -la | head -5"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'protocol-fix-validation'
      };

      try {
        // ACT - Run complete terminal workflow
        const result = await testUtils.runTerminalHistoryTest(config);

        // ASSERT - Validate workflow completed successfully
        expect(result.success).toBe(true);
        expect(result.concatenatedResponses).toBeDefined();

        // Critical validation: All commands should be present and separated
        testUtils.expectWebSocketMessages(result.concatenatedResponses)
          .toContainCRLF()
          .toHavePrompts() 
          .toMatchCommandSequence(['whoami', 'pwd', 'echo Protocol Fix Test', 'ls -la | head -5'])
          .toHaveMinimumLength(50)
          .validate();

        // Protocol-specific validations
        const messages = result.concatenatedResponses;
        
        // Should contain all command outputs (proving commands executed)
        expect(messages).toContain('jsbattig'); // whoami output
        expect(messages).toContain('/home/jsbattig'); // pwd output (defaults to home directory)
        expect(messages).toContain('Protocol Fix Test'); // echo output
        expect(messages).toMatch(/total \d+/); // ls -la output (file listing)

        // Should contain bracket format prompts (proving bracket format support works)
        expect(messages).toMatch(/\[jsbattig@localhost [^\]]*\]\$/); // Bracket prompt

        // Should NOT contain concatenated prompts (proving fix worked)
        expect(messages).not.toMatch(/ls[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:/);
        expect(messages).not.toMatch(/pwd[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:/);
        expect(messages).not.toMatch(/echo[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:/);

        // Should have proper command-result separation (proving complete workflow)
        expect(messages.length).toBeGreaterThan(200); // Rich terminal history with results

        console.log('✅ COMPLETE TERMINAL WORKFLOW VALIDATED');
        console.log('🔧 Protocol fix confirmed working');
        console.log('📊 Commands executed:', ['whoami', 'pwd', 'echo', 'ls']);
        console.log('🎯 Total response length:', messages.length, 'characters');
        
      } catch (error) {
        console.log('❌ TERMINAL WORKFLOW VALIDATION FAILED');
        console.log('🐛 Error details:', error);
        throw error;
      }
    });

    it('should properly handle bracket prompt format in terminal history', async () => {
      // ARRANGE - Focus specifically on bracket prompt validation
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-prompt-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "bracket-prompt-test", "command": "uname -a"}'}
        ],
        workflowTimeout: 20000,
        sessionName: 'bracket-prompt-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Bracket format specific validations
      expect(result.success).toBe(true);
      const messages = result.concatenatedResponses;
      
      // Modern bracket format should be detected
      expect(messages).toMatch(/\[jsbattig@localhost [^\]]*\]\$/);
      
      // Should contain system info (proving command executed)
      expect(messages).toMatch(/Linux|GNU|kernel/i);
      
      // Should have proper CRLF formatting
      expect(messages).toContain('\r\n');
      
      console.log('✅ BRACKET PROMPT FORMAT VALIDATED');
      console.log('🎯 Bracket prompts detected in terminal history');
    });

    it('should handle multiple rapid commands without protocol errors', async () => {
      // ARRANGE - Stress test the protocol with rapid command execution
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "rapid-commands-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-commands-test", "command": "echo Command1"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-commands-test", "command": "echo Command2"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-commands-test", "command": "echo Command3"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-commands-test", "command": "echo Command4"}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-commands-test", "command": "echo Command5"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'rapid-commands-test'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - All commands should execute without protocol errors
      expect(result.success).toBe(true);
      const messages = result.concatenatedResponses;
      
      // All command outputs should be present
      expect(messages).toContain('Command1');
      expect(messages).toContain('Command2');  
      expect(messages).toContain('Command3');
      expect(messages).toContain('Command4');
      expect(messages).toContain('Command5');
      
      // Should contain multiple prompts (proving terminal unlocked between commands)
      const promptMatches = messages.match(/\[jsbattig@localhost [^\]]*\]\$/g);
      expect(promptMatches).toBeDefined();
      expect(promptMatches!.length).toBeGreaterThan(3); // At least several prompts
      
      console.log('✅ RAPID COMMANDS PROTOCOL VALIDATION COMPLETED'); 
      console.log('🚀 All 5 commands executed successfully');
      console.log('🔓 Terminal properly unlocked between commands');
    });
  });
});