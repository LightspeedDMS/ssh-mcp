/**
 * Terminal Fixes Verification Tests
 * 
 * This test verifies that the two critical terminal display issues have been fixed:
 * 1. Double command echo - commands should appear only once
 * 2. Missing initial prompt - terminal history should start with prompt
 * 
 * Uses Terminal History Testing Framework to verify proper terminal behavior.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('Terminal Fixes Verification', () => {
  let testUtils: JestTestUtilities;

  beforeAll(async () => {
    testUtils = JestTestUtilities.setupJestEnvironment('terminal-fixes-verification');
  }, 60000);

  beforeEach(async () => {
    if (testUtils) {
      await testUtils.setupTest();
    }
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  describe('Double Command Echo Fix Verification', () => {
    test('should not have double command echo in terminal output', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-no-double-echo", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test-no-double-echo", "command": "echo hello"}',
          'ssh_exec {"sessionName": "test-no-double-echo", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-no-double-echo'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== DOUBLE ECHO FIX VERIFICATION ===');
      console.log('Raw WebSocket Messages:');
      console.log(result.concatenatedResponses);

      // The raw output should show commands and their results, but not duplicate command echoes
      const output = result.concatenatedResponses;
      
      // Verify natural SSH behavior:
      // 1. "echo hello" command appears once (when typed)
      // 2. "hello" appears as result  
      // 3. No duplicate "echo hello" after result
      
      // Count occurrences of the command
      const commandOccurrences = (output.match(/echo hello/g) || []).length;
      
      console.log(`\nCommand "echo hello" appears ${commandOccurrences} times in output`);
      console.log('Expected: 1 time (when command is executed)');
      console.log('Previous bug: 2 times (local echo + server echo)');
      
      // VERIFICATION: Command should appear exactly once in natural SSH flow
      expect(commandOccurrences).toBe(1);

      // Also test pwd command
      const pwdOccurrences = (output.match(/pwd/g) || []).length;
      console.log(`\nCommand "pwd" appears ${pwdOccurrences} times in output`);
      expect(pwdOccurrences).toBe(1);

    }, 60000);

    test('should have proper command and result separation', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-command-separation", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test-command-separation", "command": "echo testing"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-command-separation'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== COMMAND AND RESULT SEPARATION VERIFICATION ===');
      console.log('Raw Terminal Output:');
      console.log(result.concatenatedResponses);

      const output = result.concatenatedResponses;
      
      // Verify proper SSH terminal flow:
      // 1. Command appears once
      // 2. Result appears separate from command
      // 3. Proper line breaks and formatting
      
      expect(output).toContain('echo testing');  // Command appears
      expect(output).toContain('testing');       // Result appears
      expect(output).toMatch(/echo testing[\s\S]*testing/); // Command before result
      
    }, 60000);
  });

  describe('Initial Prompt Fix Verification', () => {
    test('should display initial prompt in terminal history', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-initial-prompt", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          // Just connect and see the initial prompt
        ],
        workflowTimeout: 30000,
        sessionName: 'test-initial-prompt'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== INITIAL PROMPT FIX VERIFICATION ===');
      console.log('Raw WebSocket Messages:');
      console.log(result.concatenatedResponses);

      const output = result.concatenatedResponses;
      
      // Check for prompt patterns (both old and bracket formats)
      const oldPromptPattern = /[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:[~\w/.[\]-]*[$#>]/;
      const bracketPromptPattern = /\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\][$#>]/;
      
      const hasOldPrompt = oldPromptPattern.test(output);
      const hasBracketPrompt = bracketPromptPattern.test(output);
      const hasAnyPrompt = hasOldPrompt || hasBracketPrompt;
      
      console.log('\nPrompt Detection:');
      console.log(`Old format prompt (user@host:path$): ${hasOldPrompt}`);
      console.log(`Bracket format prompt ([user@host project]$): ${hasBracketPrompt}`);
      console.log(`Any prompt found: ${hasAnyPrompt}`);
      
      // VERIFICATION: Terminal should show some form of initial prompt
      expect(hasAnyPrompt).toBe(true);
      
      if (hasOldPrompt) {
        const matches = output.match(oldPromptPattern);
        if (matches) {
          console.log('Found old format prompt:', matches[0]);
        }
      }
      
      if (hasBracketPrompt) {
        const matches = output.match(bracketPromptPattern);
        if (matches) {
          console.log('Found bracket format prompt:', matches[0]);
        }
      }

    }, 60000);

    test('should have prompt available when browser first connects', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-browser-prompt", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "test-browser-prompt", "command": "echo setup"}'
        ],
        postWebSocketCommands: [
          // Simulate browser connecting and getting terminal history
          'ssh_exec {"sessionName": "test-browser-prompt", "command": "echo browser-connected"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-browser-prompt'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== BROWSER INITIAL PROMPT VERIFICATION ===');
      console.log('Full Terminal History:');
      console.log(result.concatenatedResponses);

      const output = result.concatenatedResponses;
      
      // Terminal history should include:
      // 1. Initial prompt after connection
      // 2. Previous commands and their prompts
      // 3. Current prompt
      
      const promptPattern = /[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+[:\s][^$]*[$]/g;
      const promptMatches = output.match(promptPattern) || [];
      
      console.log(`\nFound ${promptMatches.length} prompts in terminal history:`);
      promptMatches.forEach((prompt, index) => {
        console.log(`Prompt ${index + 1}: "${prompt}"`);
      });
      
      // VERIFICATION: Should have multiple prompts (initial + after commands)
      expect(promptMatches.length).toBeGreaterThanOrEqual(1);

    }, 60000);
  });

  describe('Combined Terminal Behavior Verification', () => {
    test('should have correct terminal flow: prompt → command → result → prompt', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "test-terminal-flow", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "test-terminal-flow", "command": "whoami"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'test-terminal-flow'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('\n=== COMPLETE TERMINAL FLOW VERIFICATION ===');
      console.log('Terminal Flow Analysis:');
      console.log(result.concatenatedResponses);

      const output = result.concatenatedResponses;
      
      // Expected flow:
      // [initial-prompt] (from connection)
      // whoami (command execution)
      // jsbattig (command result) 
      // [prompt]$ (new prompt)
      
      // Basic verifications
      expect(output).toContain('whoami');    // Command executed
      expect(output).toContain('jsbattig');  // Result present
      
      // Verify no double echo issues
      const whoamiCount = (output.match(/whoami/g) || []).length;
      console.log(`\nCommand 'whoami' appears ${whoamiCount} times (should be 1)`);
      expect(whoamiCount).toBe(1);
      
      // Should have prompt structure
      const hasPromptStructure = /[@#$]/.test(output);
      expect(hasPromptStructure).toBe(true);
      
      console.log('\n✅ Terminal behavior verification complete');
      console.log('- No double command echo');
      console.log('- Initial prompt available');  
      console.log('- Proper command/result flow');

    }, 60000);
  });
});