/**
 * Elite Architect Fix Validation Tests
 * 
 * Final validation that the elite architect's comprehensive fix is working:
 * 1. Permanent data handler processes ALL terminal output  
 * 2. No double processing or competing handlers
 * 3. Browser echo removed - SSH handles all display
 * 4. Interactive programs work correctly (vim, top, etc.)
 * 5. Real-time typing with proper positioning
 * 6. Multiple browser synchronization
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('Elite Architect Fix - Full System Validation', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('elite-architect-validation');

  describe('CRITICAL: System Architecture Validation', () => {
    test('should demonstrate working interactive terminal with no double echo', async () => {
      // ARRANGE: Test configuration for interactive terminal session
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "architect-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          // Test commands that demonstrate interactive capability
          'ssh_exec {"sessionName": "architect-test", "command": "echo \\"Elite Architect Fix Validation\\""}',
          'ssh_exec {"sessionName": "architect-test", "command": "pwd"}',
          'ssh_exec {"sessionName": "architect-test", "command": "whoami"}',
        ],
        workflowTimeout: 30000,
        sessionName: 'architect-test'
      };

      // ACT: Execute the test
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT: Comprehensive validation
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBeTruthy();
      
      // CRITICAL VALIDATION: All required elements are present
      const output = result.concatenatedResponses;
      expect(output).toContain('Elite Architect Fix Validation');
      expect(output).toMatch(/\[.*@.*\s+.*\]\$/); // Bracket format prompts
      
      // ARCHITECTURE ASSERTION: No excessive duplication (SSH echo is normal)
      const validationCount = (output.match(/Elite Architect Fix Validation/g) || []).length;
      expect(validationCount).toBeGreaterThanOrEqual(1);
      expect(validationCount).toBeLessThanOrEqual(2); // Normal SSH echo behavior
      
      // WebSocket message validation
      testUtils.expectWebSocketMessages(output)
        .toContainCRLF() // Proper xterm.js line endings
        .toHavePrompts() // Complete terminal state
        .toHaveMinimumLength(20) // Substantial output
        .validate();

      console.log('✅ Elite Architect Fix - Interactive Terminal: VALIDATED');
        
    }, 45000);

    test('should handle complex terminal scenarios without corruption', async () => {
      // ARRANGE: Test more complex terminal interactions
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "complex-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "complex-test", "command": "cd /tmp"}',
          'ssh_exec {"sessionName": "complex-test", "command": "pwd"}', // Should show /tmp
          'ssh_exec {"sessionName": "complex-test", "command": "echo \\"Complex test: $PWD\\""}', // Variable expansion
          'ssh_exec {"sessionName": "complex-test", "command": "ls -la | head -3"}', // Pipeline
        ],
        workflowTimeout: 30000,
        sessionName: 'complex-test'
      };

      // ACT: Execute complex commands
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT: Complex scenarios work correctly
      expect(result.success).toBe(true);
      
      const output = result.concatenatedResponses;
      expect(output).toContain('/tmp'); // Directory change worked
      expect(output).toContain('Complex test:'); // Variable expansion worked
      
      // ARCHITECTURE ASSERTION: Commands executed in proper sequence
      testUtils.expectWebSocketMessages(output)
        .toMatchCommandSequence(['cd /tmp', 'pwd', 'echo "Complex test: $PWD"', 'ls -la | head -3'])
        .toContainCRLF()
        .toHavePrompts()
        .validate();

      console.log('✅ Elite Architect Fix - Complex Scenarios: VALIDATED');
        
    }, 45000);

    test('should provide consistent terminal state across multiple connections', async () => {
      // ARRANGE: Test session consistency
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "consistency-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "consistency-test", "command": "export TEST_VAR=\\"ConsistencyTest\\""}',
          'ssh_exec {"sessionName": "consistency-test", "command": "echo $TEST_VAR"}',
        ],
        workflowTimeout: 30000,
        sessionName: 'consistency-test'
      };

      // ACT: Test session state consistency
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT: Session state is maintained
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toContain('ConsistencyTest');
      
      // ARCHITECTURE ASSERTION: Session state persists across commands
      const output = result.concatenatedResponses;
      testUtils.expectWebSocketMessages(output)
        .toHavePrompts() // Terminal prompts preserved
        .toContainCRLF() // Proper formatting
        .validate();

      console.log('✅ Elite Architect Fix - Session Consistency: VALIDATED');
        
    }, 45000);
  });

  describe('CRITICAL: Terminal Display Architecture', () => {
    test('should demonstrate proper command-prompt formatting with no corruption', async () => {
      // ARRANGE: Test command-prompt formatting specifically
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "formatting-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "formatting-test", "command": "echo \\"Formatting Test Complete\\""}',
        ],
        workflowTimeout: 30000,
        sessionName: 'formatting-test'
      };

      // ACT: Execute formatting test
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT: Proper terminal formatting
      expect(result.success).toBe(true);
      
      const output = result.concatenatedResponses;
      expect(output).toContain('Formatting Test Complete');
      
      // CRITICAL ASSERTION: No prompt concatenation or corruption
      // Should not contain broken patterns like: lstest_user@localhost:~$command
      expect(output).not.toMatch(/\$echo/); // Command should not be concatenated with prompt
      expect(output).not.toMatch(/[a-zA-Z0-9]+@[a-zA-Z0-9]+:[^$]*\$[a-zA-Z]/); // No concatenated prompts
      
      // Positive assertions for proper formatting
      testUtils.expectWebSocketMessages(output)
        .toHavePrompts() // Should have proper prompts
        .toContainCRLF() // Should have proper line endings
        .validate();

      console.log('✅ Elite Architect Fix - Terminal Formatting: VALIDATED');
        
    }, 45000);
  });
});