/**
 * VILLENELE VALIDATION: PS1 Export Command Silence Test
 * 
 * This test validates that PS1 export commands are executed silently
 * and do not appear as visible output in the terminal display.
 * 
 * ROOT ISSUE FIXED: export PS1='[\u@\h \W]\$ ' commands were appearing 
 * as visible terminal output instead of executing silently.
 * 
 * SOLUTION: Added >/dev/null 2>&1 to redirect output and make commands silent.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';

describe('PS1 Export Silence Validation - Villenele Framework', () => {
  const testSessionName = 'ps1-export-silence-test';
  const testUtils = JestTestUtilities.setupJestEnvironment('ps1-export-silence-validation');

  describe('CRITICAL FIX: Silent PS1 Export Commands', () => {
    it('should NOT display export PS1 commands as visible terminal output', async () => {
      // This test validates that PS1 configuration happens silently during initialization
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "' + testSessionName + '", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "' + testSessionName + '", "command": "echo \\"test command output\\""}',
          'ssh_exec {"sessionName": "' + testSessionName + '", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: testSessionName
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('=== PS1 EXPORT SILENCE VALIDATION ===');
      console.log('Full terminal output:');
      console.log(JSON.stringify(result.concatenatedResponses));
      console.log('=====================================');

      // CRITICAL ASSERTION: Must NOT contain visible export PS1 commands
      const exportPs1Pattern = /export PS1=.*[\r\n]/g;
      const exportMatches = result.concatenatedResponses.match(exportPs1Pattern);
      
      if (exportMatches) {
        console.log('❌ VISIBLE EXPORT COMMANDS DETECTED:');
        exportMatches.forEach((match, i) => {
          console.log(`   ${i + 1}. "${match.trim()}"`);
        });
        console.log('   Expected: No visible export commands');
        console.log('   Actual: Export commands visible in terminal output');
      } else {
        console.log('✅ PS1 EXPORT COMMANDS: Silent (not visible in output)');
      }

      // POSITIVE ASSERTION: Should contain clean bracket format prompts
      const bracketPromptPattern = /\[jsbattig@localhost [^\]]+\]\$/g;
      const bracketMatches = result.concatenatedResponses.match(bracketPromptPattern);
      
      console.log('✅ BRACKET PROMPT ANALYSIS:');
      if (bracketMatches) {
        console.log(`   Found ${bracketMatches.length} bracket format prompts:`);
        bracketMatches.forEach((match, i) => {
          console.log(`   ${i + 1}. "${match}"`);
        });
      } else {
        console.log('   ⚠️  No bracket format prompts detected');
      }

      // COMMAND OUTPUT VALIDATION: Should contain actual command results
      const commandOutputPatterns = [
        'test command output',
        '/home/jsbattig'
      ];

      console.log('📝 COMMAND OUTPUT VALIDATION:');
      for (const expectedOutput of commandOutputPatterns) {
        if (result.concatenatedResponses.includes(expectedOutput)) {
          console.log(`   ✅ Found expected output: "${expectedOutput}"`);
        } else {
          console.log(`   ❌ Missing expected output: "${expectedOutput}"`);
        }
      }

      // MAIN ASSERTIONS
      
      // 1. NO VISIBLE EXPORT COMMANDS: Must not show PS1 export commands
      expect(result.concatenatedResponses).not.toMatch(exportPs1Pattern);
      
      // 2. BRACKET PROMPTS PRESENT: Must have clean bracket format prompts
      expect(result.concatenatedResponses).toMatch(bracketPromptPattern);
      
      // 3. COMMAND RESULTS PRESENT: Must show actual command output
      expect(result.concatenatedResponses).toContain('test command output');
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      
      // 4. CLEAN TERMINAL FLOW: Should have proper command/response separation
      const lines = result.concatenatedResponses.split(/\r?\n/);
      let hasCleanFlow = false;
      
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        
        // Look for pattern: bracket prompt + command, followed by result
        if (line.includes('[jsbattig@localhost') && line.includes('echo') && 
            nextLine && nextLine.includes('test command output')) {
          hasCleanFlow = true;
          console.log('✅ CLEAN TERMINAL FLOW: Command and response properly separated');
          console.log(`   Command line: "${line}"`);
          console.log(`   Response line: "${nextLine}"`);
          break;
        }
      }
      
      expect(hasCleanFlow).toBe(true);

      console.log('✅ All PS1 export silence validation tests PASSED');
      
    }, 45000);

    it('should maintain bracket prompt format consistency without visible configuration', async () => {
      // Test multiple command sequence to ensure consistent prompt format
      // without any visible PS1 configuration commands
      
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "' + testSessionName + '-multi", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "' + testSessionName + '-multi", "command": "whoami"}',
          'ssh_exec {"sessionName": "' + testSessionName + '-multi", "command": "date"}',
          'ssh_exec {"sessionName": "' + testSessionName + '-multi", "command": "ls | head -3"}'
        ],
        workflowTimeout: 45000,
        sessionName: testSessionName + '-multi'
      };

      const result = await testUtils.runTerminalHistoryTest(config);

      console.log('=== PROMPT CONSISTENCY VALIDATION ===');
      
      // Extract all prompts from the output
      const allPrompts = result.concatenatedResponses.match(/\[jsbattig@localhost [^\]]+\]\$/g) || [];
      console.log(`Found ${allPrompts.length} total prompts:`);
      allPrompts.forEach((prompt, i) => {
        console.log(`  ${i + 1}. "${prompt}"`);
      });

      // Check for any visible export commands
      const visibleExports = result.concatenatedResponses.match(/export PS1=/g) || [];
      console.log(`Visible export commands: ${visibleExports.length}`);
      
      if (visibleExports.length > 0) {
        console.log('❌ CONFIGURATION LEAK: PS1 exports are visible');
        visibleExports.forEach((exp, i) => {
          console.log(`  ${i + 1}. Found: "${exp}"`);
        });
      } else {
        console.log('✅ SILENT CONFIGURATION: No visible PS1 exports');
      }

      // Assertions
      expect(allPrompts.length).toBeGreaterThan(2); // Should have multiple consistent prompts
      expect(visibleExports.length).toBe(0); // Should have zero visible export commands
      expect(result.concatenatedResponses).toContain('jsbattig'); // whoami result
      expect(result.concatenatedResponses).toMatch(/\d{4}/); // date result should contain year

      console.log('✅ Prompt consistency validation PASSED');
    }, 60000);
  });
});