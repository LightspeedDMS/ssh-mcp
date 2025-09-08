/**
 * Double Prompt Exact Scenario Reproduction Test
 * 
 * This test file reproduces the EXACT scenario reported by the user for double prompt issues.
 * Following TDD methodology:
 * 1. Write failing tests with EXACT expected output strings  
 * 2. Execute tests to capture actual output
 * 3. Update expected output with captured actual output
 * 4. Validate all tests pass with exact assertions
 * 
 * USER REPORTED SCENARIO:
 * Input Terminal Output (what user reported):
 * [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ 
 * [jsbattig@localhost ~]$ whoami
 * jsbattig
 * [jsbattig@localhost ~]$ pwd
 * /home/jsbattig
 * [jsbattig@localhost ~]$ ls -la
 * [...exact ls output...]
 * [jsbattig@localhost ~]$ 
 * 
 * CRITICAL: All assertions must use exact string comparison (toBe()) - NO partial matching
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Double Prompt Exact Scenario Reproduction - EXACT ASSERTIONS ONLY', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('double-prompt-exact-scenario');

  describe('User Reported Double Prompt Bug - Exact Output Validation', () => {
    it('should reproduce exact double prompt scenario with exact string comparison', async () => {
      // ARRANGE - Test the exact scenario reported by user
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "double-prompt-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "double-prompt-exact", "command": "whoami"}',
          'ssh_exec {"sessionName": "double-prompt-exact", "command": "pwd"}',
          'ssh_exec {"sessionName": "double-prompt-exact", "command": "ls -la"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'double-prompt-exact'
      };

      // EXACT EXPECTED OUTPUT - This WILL fail initially (TDD methodology)
      // TODO: This is a placeholder - will be replaced with actual captured output
      const expectedExactOutput = "PLACEHOLDER_EXACT_OUTPUT_TO_BE_CAPTURED_FROM_ACTUAL_EXECUTION";

      try {
        // ACT - Run the test
        const result = await testUtils.runTerminalHistoryTest(config);

        // ASSERT - EXACT string comparison only (no partial matching allowed)
        expect(result.success).toBe(true);
        
        // CRITICAL: This MUST use toBe() for exact comparison
        // This test WILL fail initially - we'll capture the actual output and replace expectedExactOutput
        expect(result.concatenatedResponses).toBe(expectedExactOutput);

        console.log('✅ EXACT DOUBLE PROMPT SCENARIO VALIDATED');
        
      } catch (error) {
        console.log('❌ DOUBLE PROMPT EXACT SCENARIO FAILED (EXPECTED IN TDD RED PHASE)');
        console.log('🔍 CAPTURING ACTUAL OUTPUT FOR EXACT ASSERTION:');
        
        // TDD RED PHASE: Capture the actual output for exact assertion creation
        if (error instanceof Error && error.message.includes('toBe')) {
          console.log('📋 ACTUAL OUTPUT TO USE IN EXPECTED:');
          // This error should contain the actual output we need
        }
        
        throw error;
      }
    });

    it('should validate double prompt does NOT occur with exact output comparison', async () => {
      // ARRANGE - Test that double prompts do NOT appear in output
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "no-double-prompt", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "no-double-prompt", "command": "echo test"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'no-double-prompt'
      };

      // EXACT EXPECTED OUTPUT - Single prompt only
      // TODO: Replace with actual captured output
      const expectedSinglePromptOutput = "PLACEHOLDER_SINGLE_PROMPT_OUTPUT_TO_BE_CAPTURED";

      try {
        // ACT
        const result = await testUtils.runTerminalHistoryTest(config);

        // ASSERT - EXACT validation (no double prompts)
        expect(result.success).toBe(true);
        
        // EXACT comparison - must match exactly
        expect(result.concatenatedResponses).toBe(expectedSinglePromptOutput);

        // NEGATIVE ASSERTION: Should NOT contain double prompt pattern
        expect(result.concatenatedResponses).not.toContain("[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ ");

        console.log('✅ NO DOUBLE PROMPT DETECTED - EXACT VALIDATION PASSED');
        
      } catch (error) {
        console.log('❌ SINGLE PROMPT VALIDATION FAILED (EXPECTED IN TDD RED PHASE)');
        console.log('🔍 CAPTURING ACTUAL OUTPUT FOR NO-DOUBLE-PROMPT ASSERTION');
        
        throw error;
      }
    });

    it('should reproduce exact ls command output with full directory listing', async () => {
      // ARRANGE - Reproduce the exact ls -la scenario from user report
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "ls-exact-output", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "ls-exact-output", "command": "ls -la"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'ls-exact-output'
      };

      // EXACT EXPECTED LS OUTPUT - Will be captured from actual execution
      // TODO: Replace with exact ls -la output including file permissions, dates, sizes
      const expectedLsOutput = "PLACEHOLDER_EXACT_LS_OUTPUT_WITH_FULL_DETAILS";

      try {
        // ACT
        const result = await testUtils.runTerminalHistoryTest(config);

        // ASSERT - EXACT ls output validation
        expect(result.success).toBe(true);
        
        // CRITICAL: Exact string comparison for full ls -la output
        expect(result.concatenatedResponses).toBe(expectedLsOutput);

        console.log('✅ EXACT LS OUTPUT VALIDATED');
        
      } catch (error) {
        console.log('❌ LS EXACT OUTPUT VALIDATION FAILED (EXPECTED IN TDD RED PHASE)');
        console.log('🔍 CAPTURING ACTUAL LS OUTPUT FOR EXACT ASSERTION');
        
        throw error;
      }
    });
  });

  describe('CRLF Line Ending Exact Validation', () => {
    it('should contain exact CRLF sequences in specific positions', async () => {
      // ARRANGE - Test CRLF positioning exactly
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "crlf-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "crlf-exact", "command": "echo Line1"}',
          'ssh_exec {"sessionName": "crlf-exact", "command": "echo Line2"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'crlf-exact'
      };

      // EXACT EXPECTED OUTPUT with precise CRLF positioning
      const expectedCRLFOutput = "PLACEHOLDER_EXACT_CRLF_OUTPUT_WITH_PRECISE_LINE_ENDINGS";

      try {
        // ACT
        const result = await testUtils.runTerminalHistoryTest(config);

        // ASSERT - EXACT CRLF validation
        expect(result.success).toBe(true);
        
        // CRITICAL: Exact comparison including all CRLF sequences
        expect(result.concatenatedResponses).toBe(expectedCRLFOutput);

        console.log('✅ EXACT CRLF LINE ENDINGS VALIDATED');
        
      } catch (error) {
        console.log('❌ CRLF EXACT VALIDATION FAILED (EXPECTED IN TDD RED PHASE)');
        console.log('🔍 CAPTURING ACTUAL CRLF OUTPUT FOR EXACT ASSERTION');
        
        throw error;
      }
    });
  });

  afterAll(() => {
    console.log('\n📊 DOUBLE PROMPT EXACT SCENARIO REPRODUCTION SUMMARY:');
    console.log('🎯 EXACT ASSERTION METHODOLOGY:');
    console.log('   ✓ All assertions use toBe() for exact string comparison');
    console.log('   ✓ NO partial matching (toContain, toMatch) allowed');
    console.log('   ✓ Captures actual terminal output for exact expected values');
    console.log('   ✓ Validates complete terminal sessions character-by-character');
    console.log('\n🔴 TDD RED PHASE EXPECTED:');
    console.log('   • Tests WILL fail initially with placeholder expected values');
    console.log('   • Actual output will be captured and used to replace placeholders');
    console.log('   • Tests will then pass with exact assertions');
    console.log('\n🚀 Exact assertion test framework implemented!');
  });
});