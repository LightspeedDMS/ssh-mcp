/**
 * VILLENELE BUG REPRODUCTION: Double Prompt at Session Initialization
 * 
 * This test reproduces the specific issue reported:
 * "[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ " - two prompts on first line
 * 
 * Expected behavior: Single clean prompt at session initialization
 * Actual behavior: Duplicate prompt at the beginning of terminal history
 * 
 * ROOT CAUSE: Shell initialization is still generating duplicate prompts
 * despite PS1 export filtering being implemented.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('Double Prompt Initialization Bug - Villenele Reproduction', () => {
  const testSessionName = 'double-prompt-bug-test';
  const testUtils = JestTestUtilities.setupJestEnvironment('double-prompt-initialization-bug');

  describe('BUG REPRODUCTION: Double Prompt at Session Start', () => {
    it('should reproduce the double prompt issue at session initialization', async () => {
      // This test specifically looks for the reported bug pattern
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "' + testSessionName + '", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "' + testSessionName + '", "command": "whoami"}',
          'ssh_exec {"sessionName": "' + testSessionName + '", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: testSessionName
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('=== DOUBLE PROMPT BUG ANALYSIS ===');
      console.log('Full terminal output:');
      console.log(JSON.stringify(result.concatenatedResponses));
      console.log('======================================');

      // ANALYZE FIRST LINE FOR DOUBLE PROMPT PATTERN
      const lines = result.concatenatedResponses.split(/\r?\n/);
      const firstLine = lines[0] || '';
      
      console.log('🔍 FIRST LINE ANALYSIS:');
      console.log(`   First line: "${firstLine}"`);
      console.log(`   Length: ${firstLine.length} characters`);
      
      // DETECT SPECIFIC DOUBLE PROMPT PATTERN
      const doublePromptPattern = /\[jsbattig@localhost [^\]]+\]\$ \[jsbattig@localhost [^\]]+\]\$/;
      const hasDoublePrompt = doublePromptPattern.test(firstLine);
      
      if (hasDoublePrompt) {
        console.log('❌ DOUBLE PROMPT DETECTED on first line!');
        console.log('   Pattern: [user@host dir]$ [user@host dir]$');
        console.log('   Expected: [user@host dir]$ (single prompt)');
      } else {
        console.log('✅ NO DOUBLE PROMPT: First line is clean');
      }

      // COUNT ALL BRACKET PROMPTS IN FIRST LINE
      const promptsInFirstLine = (firstLine.match(/\[jsbattig@localhost [^\]]+\]\$/g) || []).length;
      console.log(`📊 PROMPT COUNT IN FIRST LINE: ${promptsInFirstLine}`);
      
      if (promptsInFirstLine > 1) {
        console.log('❌ MULTIPLE PROMPTS IN FIRST LINE');
        console.log('   This indicates initialization duplication issue');
      } else if (promptsInFirstLine === 1) {
        console.log('✅ SINGLE PROMPT IN FIRST LINE');
      } else {
        console.log('⚠️  NO PROMPTS IN FIRST LINE (unexpected)');
      }

      // ANALYZE INITIALIZATION BEHAVIOR
      console.log('🔬 INITIALIZATION SEQUENCE ANALYSIS:');
      const firstFewLines = lines.slice(0, 5);
      firstFewLines.forEach((line, i) => {
        const promptCount = (line.match(/\[jsbattig@localhost [^\]]+\]\$/g) || []).length;
        console.log(`   Line ${i + 1}: "${line}" (${promptCount} prompts)`);
      });

      // DETAILED PATTERN ANALYSIS
      console.log('🔍 DETAILED PATTERN DETECTION:');
      
      // Look for specific reported pattern: "[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ "
      const exactReportedPattern = /\[jsbattig@localhost ~\]\$ \[jsbattig@localhost ~\]\$ ?$/;
      if (exactReportedPattern.test(firstLine)) {
        console.log('🎯 EXACT REPORTED BUG PATTERN MATCHED!');
        console.log('   "[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ "');
      }

      // ASSERTIONS FOR BUG VALIDATION
      
      // The test should demonstrate the bug exists (expecting failure until fixed)
      console.log('📋 TEST RESULTS:');
      console.log(`   Double prompt detected: ${hasDoublePrompt}`);
      console.log(`   Prompts in first line: ${promptsInFirstLine}`);
      console.log(`   Expected behavior: Single prompt at initialization`);
      console.log(`   Actual behavior: ${promptsInFirstLine > 1 ? 'Multiple prompts' : 'Single prompt'}`);

      // DOCUMENT THE BUG FOR FIXING
      if (hasDoublePrompt || promptsInFirstLine > 1) {
        console.log('🐛 BUG CONFIRMED: Double prompt initialization issue reproduced');
        console.log('   Next step: Identify and fix root cause in SSH shell initialization');
      } else {
        console.log('✅ BUG NOT REPRODUCED: Initialization appears clean');
      }
      
      // For now, we're documenting the bug - this test may fail until root cause is fixed
      expect(promptsInFirstLine).toBeLessThanOrEqual(1); // Should be exactly 1, never more
      
    }, 45000);

    it('should show clean terminal flow after the initial double prompt issue', async () => {
      // This test validates that despite the initialization issue, 
      // the rest of the terminal interaction works correctly
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "' + testSessionName + '-flow", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "' + testSessionName + '-flow", "command": "echo \\"test-command-1\\""}',
          'ssh_exec {"sessionName": "' + testSessionName + '-flow", "command": "echo \\"test-command-2\\""}',
          'ssh_exec {"sessionName": "' + testSessionName + '-flow", "command": "pwd"}'
        ],
        workflowTimeout: 45000,
        sessionName: testSessionName + '-flow'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      console.log('=== TERMINAL FLOW AFTER INITIALIZATION ===');
      
      const lines = result.concatenatedResponses.split(/\r?\n/);
      
      // Skip the potentially problematic first line and analyze the rest
      let commandLines = 0;
      let responseLines = 0;
      let cleanFlowFound = false;
      
      for (let i = 1; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        
        // Look for clean command/response patterns
        if (line.includes('[jsbattig@localhost') && line.includes('echo') && 
            nextLine && (nextLine.includes('test-command-') || nextLine.includes('/home/jsbattig'))) {
          commandLines++;
          responseLines++;
          cleanFlowFound = true;
          console.log(`✅ Clean flow found: "${line}" → "${nextLine}"`);
        }
      }
      
      console.log(`📊 FLOW ANALYSIS RESULTS:`);
      console.log(`   Clean command/response pairs: ${Math.min(commandLines, responseLines)}`);
      console.log(`   Clean flow detected: ${cleanFlowFound}`);
      
      // Validate that despite initialization issues, the terminal flow works
      expect(cleanFlowFound).toBe(true);
      expect(result.concatenatedResponses).toContain('test-command-1');
      expect(result.concatenatedResponses).toContain('test-command-2');
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      
      console.log('✅ Terminal flow validation PASSED (despite potential initialization issue)');
      
    }, 60000);
  });
});