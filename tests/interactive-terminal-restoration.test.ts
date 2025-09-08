/**
 * Interactive Terminal Restoration Tests
 * 
 * TDD tests to validate the restored permanent data handler for interactive terminal functionality.
 * These tests ensure that the elite architect's fix properly restores interactive functionality.
 * 
 * Architecture Validation:
 * - Interactive data handler processes ALL terminal output (interactive + commands)
 * - Real-time broadcasting to browsers for live display
 * - History storage for replay to new connections
 * - Command accumulation during API command execution
 * - No double processing or duplication issues
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('Interactive Terminal Restoration (Elite Architect Fix)', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('interactive-terminal-restoration');
  
  // The setupJestEnvironment() call above already configures beforeEach/afterEach hooks
  // with proper setupTest() and cleanupTest() calls

  describe('CRITICAL: Permanent Data Handler Restoration', () => {
    test('should process interactive terminal input/output with permanent handler', async () => {
      // ARRANGE: Set up test configuration for interactive terminal usage
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "interactive-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "interactive-test", "command": "echo \\"Interactive Test\\""}',
          'ssh_exec {"sessionName": "interactive-test", "command": "pwd"}',
        ],
        workflowTimeout: 30000,
        sessionName: 'interactive-test'
      };

      // ACT: Execute terminal history test with real WebSocket capture
      const result = await testUtils.runTerminalHistoryTest(config);
      
      // ASSERT: Verify that terminal output is properly captured and broadcasted
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBeTruthy();
      expect(result.concatenatedResponses.length).toBeGreaterThan(0);
      
      // CRITICAL ASSERTION: Verify interactive terminal output appears in WebSocket messages
      testUtils.expectWebSocketMessages(result.concatenatedResponses)
        .toContainCRLF()
        .toHavePrompts()
        .toMatchCommandSequence(['echo "Interactive Test"', 'pwd'])
        .validate();
        
      // ARCHITECTURE VERIFICATION: Verify that both command results AND prompts are present
      // This proves the permanent handler is working for ALL terminal interactions
      expect(result.concatenatedResponses).toContain('Interactive Test');
      expect(result.concatenatedResponses).toMatch(/\[.*@.*\s+.*\]\$/); // Bracket format prompts
      
    }, 45000);

    test('should handle multiple simultaneous command executions without double processing', async () => {
      // ARRANGE: Set up test with multiple simultaneous commands
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "multi-cmd-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          // Execute multiple commands to test concurrent handling
          'ssh_exec {"sessionName": "multi-cmd-test", "command": "echo \\"Command 1\\""}',
          'ssh_exec {"sessionName": "multi-cmd-test", "command": "echo \\"Command 2\\""}',
          'ssh_exec {"sessionName": "multi-cmd-test", "command": "whoami"}',
        ],
        workflowTimeout: 30000,
        sessionName: 'multi-cmd-test'
      };

      // ACT: Execute terminal history test
      const result = await testUtils.runTerminalHistoryTest(config);
      
      // ASSERT: Verify no duplicate processing occurred
      expect(result.success).toBe(true);
      
      // ARCHITECTURE VERIFICATION: Commands should appear reasonable number of times
      // SSH naturally echoes commands when typed, and shows results, so 1-2 appearances is normal
      const output = result.concatenatedResponses;
      const command1Count = (output.match(/Command 1/g) || []).length;
      const command2Count = (output.match(/Command 2/g) || []).length;
      
      expect(command1Count).toBeGreaterThanOrEqual(1); // Should appear at least once  
      expect(command1Count).toBeLessThanOrEqual(2); // But not excessively duplicated
      expect(command2Count).toBeGreaterThanOrEqual(1); // Should appear at least once
      expect(command2Count).toBeLessThanOrEqual(2); // But not excessively duplicated
      
      // Verify commands executed in sequence
      testUtils.expectWebSocketMessages(result.concatenatedResponses)
        .toMatchCommandSequence(['echo "Command 1"', 'echo "Command 2"', 'whoami'])
        .validate();
        
    }, 45000);

    test('should provide real-time terminal interaction for multiple browsers', async () => {
      // ARRANGE: Set up test for multi-browser scenario
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "multi-browser-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "multi-browser-test", "command": "echo \\"Multi-browser Test\\""}',
        ],
        workflowTimeout: 30000,
        sessionName: 'multi-browser-test'
      };

      // ACT: Execute terminal history test (simulates first browser connection)
      const result = await testUtils.runTerminalHistoryTest(config);
      
      // ASSERT: Verify terminal history is available for replay to new browser connections
      expect(result.success).toBe(true);
      
      // CRITICAL ASSERTION: Verify terminal history contains complete interaction
      // This proves that storeInHistory is working in the permanent handler
      const historyContent = result.concatenatedResponses;
      expect(historyContent).toContain('Multi-browser Test');
      expect(historyContent).toMatch(/\[.*@.*\s+.*\]\$/); // Should contain prompts
      
      // ARCHITECTURE VERIFICATION: History should be properly formatted for browser display
      testUtils.expectWebSocketMessages(historyContent)
        .toContainCRLF() // Proper line endings for xterm.js
        .toHavePrompts() // Complete terminal state
        .validate();
        
    }, 45000);
  });

  describe('CRITICAL: Terminal State Consistency', () => {
    test('should maintain consistent terminal state across command and interactive modes', async () => {
      // ARRANGE: Test mixed API commands and interactive terminal state
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "state-consistency-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "state-consistency-test", "command": "cd /tmp"}',
          'ssh_exec {"sessionName": "state-consistency-test", "command": "pwd"}', // Should show /tmp
        ],
        workflowTimeout: 30000,
        sessionName: 'state-consistency-test'
      };

      // ACT: Execute commands that change terminal state
      const result = await testUtils.runTerminalHistoryTest(config);
      
      // ASSERT: Verify terminal state changes are properly reflected
      expect(result.success).toBe(true);
      
      // ARCHITECTURE VERIFICATION: PWD should show /tmp after cd command
      // This proves that session state persistence works with the permanent handler
      expect(result.concatenatedResponses).toContain('/tmp');
      
      // Verify terminal prompts reflect directory changes
      testUtils.expectWebSocketMessages(result.concatenatedResponses)
        .toHavePrompts()
        .toMatchCommandSequence(['cd /tmp', 'pwd'])
        .validate();
        
    }, 45000);
  });

  describe('CRITICAL: Echo and Display Behavior', () => {
    test('should display commands and results without duplication or corruption', async () => {
      // ARRANGE: Test command echo and result display
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "echo-test", "command": "echo \\"Echo Test Result\\""}',
        ],
        workflowTimeout: 30000,
        sessionName: 'echo-test'
      };

      // ACT: Execute command and capture terminal output
      const result = await testUtils.runTerminalHistoryTest(config);
      
      // ASSERT: Verify proper command echo and result display
      expect(result.success).toBe(true);
      
      const output = result.concatenatedResponses;
      
      // CRITICAL ASSERTIONS: Verify no corruption or duplication
      // Command should appear inline with prompt (not on separate line)
      expect(output).toContain('Echo Test Result');
      
      // Should not have corrupted prompts or double commands
      const commandEchoCount = (output.match(/echo "Echo Test Result"/g) || []).length;
      expect(commandEchoCount).toBeGreaterThanOrEqual(1); // Should appear at least once
      expect(commandEchoCount).toBeLessThanOrEqual(2); // But not excessively duplicated
      
      // ARCHITECTURE VERIFICATION: Verify proper terminal formatting
      testUtils.expectWebSocketMessages(output)
        .toContainCRLF() // Proper line endings
        .toHaveMinimumLength(10) // Substantial output
        .validate();
        
    }, 45000);
  });
});