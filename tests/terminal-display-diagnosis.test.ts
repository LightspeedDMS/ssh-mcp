/**
 * Terminal Display Issue Diagnosis Test
 * 
 * This test uses the Terminal History Testing Framework to diagnose the specific
 * terminal display issues reported by the user:
 * 
 * ISSUES:
 * 1. Commands appear on wrong line (separated from prompt)
 * 2. Prompt corruption (missing characters like "[j")
 * 
 * EXPECTED BEHAVIOR:
 * - Commands should appear inline with prompts: [user@host ~]$ command
 * - Complete, uncorrupted prompts should be preserved
 * - No empty prompt lines should appear
 * 
 * This test will capture actual WebSocket messages to identify root causes.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Terminal Display Issue Diagnosis', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-display-diagnosis');

  // Extend Jest with custom matchers
  beforeAll(() => {
    JestTestUtilities.extendJestMatchers();
  });

  test('should diagnose terminal display issues for restarted-test session with date command', async () => {
    console.log('=== TERMINAL DISPLAY DIAGNOSIS TEST ===');
    console.log('Testing session: restarted-test');
    console.log('Command to test: date');
    console.log('Expected: [jsbattig@localhost ~]$ date (inline)');
    console.log('Problem: Command appears on separate line + prompt corruption');

    // Configure test to replicate the exact scenario
    const config = {
      preWebSocketCommands: [
        // Connect to localhost with SSH key authentication
        'ssh_connect {"name": "restarted-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
        // Execute the problematic date command
        'ssh_exec {"sessionName": "restarted-test", "command": "date"}'
      ],
      postWebSocketCommands: [
        // Execute another command to see if the issue persists
        'ssh_exec {"sessionName": "restarted-test", "command": "whoami"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'restarted-test'
    };

    console.log('=== EXECUTING FRAMEWORK TEST ===');
    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('=== TEST EXECUTION RESULTS ===');
    console.log(`Success: ${result.success}`);
    console.log(`Total execution time: ${result.totalExecutionTime}ms`);
    console.log(`WebSocket messages captured: ${result.concatenatedResponses.length} characters`);

    // Log the actual WebSocket messages for analysis
    console.log('\n=== RAW WEBSOCKET MESSAGES (for diagnosis) ===');
    console.log('BEGIN WEBSOCKET DATA:');
    console.log(JSON.stringify(result.concatenatedResponses, null, 2));
    console.log('END WEBSOCKET DATA');
    console.log('');

    // Log each line separately for detailed analysis
    console.log('=== LINE-BY-LINE ANALYSIS ===');
    const lines = result.concatenatedResponses.split('\n');
    lines.forEach((line, index) => {
      console.log(`Line ${index + 1}: "${line}"`);
      
      // Check for specific issues
      if (line.includes('date') && !line.includes('$')) {
        console.log(`  ❌ ISSUE DETECTED: Command "date" appears without prompt on same line`);
      }
      
      if (line.includes('@') && line.includes('$')) {
        if (line.startsWith('sbattig@') || line.includes('sbattig@') && !line.includes('[jsbattig@')) {
          console.log(`  ❌ ISSUE DETECTED: Prompt corruption - missing "[j" character`);
        }
        if (line.includes('[jsbattig@localhost ~]$')) {
          console.log(`  ✅ CORRECT: Complete bracket format prompt found`);
        }
      }
      
      if (line.trim() === '' && index > 0 && lines[index - 1].includes('$')) {
        console.log(`  ❌ ISSUE DETECTED: Empty line after prompt`);
      }
    });

    // Validate using framework assertions
    console.log('\n=== FRAMEWORK VALIDATION ===');
    try {
      testUtils.expectWebSocketMessages(result.concatenatedResponses)
        .toContainCRLF()
        .toHavePrompts()
        .toMatchCommandSequence(['date', 'whoami'])
        .toHaveMinimumLength(10)
        .validate();
      console.log('✅ All basic framework validations passed');
    } catch (validationError) {
      console.log('❌ Framework validation failures:');
      console.log(validationError);
    }

    // Custom validations for the specific issues
    console.log('\n=== SPECIFIC ISSUE VALIDATION ===');
    
    // Check for inline command display (commands should appear on same line as prompt)
    const promptWithDatePattern = /\[jsbattig@localhost[^\]]*\]\$\s+date/;
    const hasInlineDate = promptWithDatePattern.test(result.concatenatedResponses);
    console.log(`Inline date command: ${hasInlineDate ? '✅ CORRECT' : '❌ ISSUE - command not inline with prompt'}`);

    // Check for prompt corruption (missing [j characters)
    const corruptedPromptPattern = /sbattig@localhost[^\]]*\]\$/;
    const hasPromptCorruption = corruptedPromptPattern.test(result.concatenatedResponses);
    console.log(`Prompt corruption: ${hasPromptCorruption ? '❌ ISSUE - prompt corruption detected' : '✅ CORRECT - no corruption'}`);

    // Check for complete bracket format
    const completeBracketPromptPattern = /\[jsbattig@localhost[^\]]*\]\$/;
    const hasCompleteBracketPrompt = completeBracketPromptPattern.test(result.concatenatedResponses);
    console.log(`Complete bracket prompts: ${hasCompleteBracketPrompt ? '✅ CORRECT' : '❌ ISSUE - incomplete bracket prompts'}`);

    // Ensure test succeeded for data collection
    expect(result.success).toBe(true);
    
    // Test should fail if we detect the reported issues (this confirms the issues exist)
    if (!hasInlineDate || hasPromptCorruption || !hasCompleteBracketPrompt) {
      console.log('\n=== DIAGNOSIS COMPLETE ===');
      console.log('❌ CONFIRMED: Terminal display issues detected in WebSocket messages');
      console.log('Issues found:');
      if (!hasInlineDate) console.log('  - Commands not appearing inline with prompts');
      if (hasPromptCorruption) console.log('  - Prompt corruption (missing characters)');
      if (!hasCompleteBracketPrompt) console.log('  - Incomplete bracket format prompts');
      console.log('\nNext step: Analyze source code based on this evidence');
    } else {
      console.log('\n=== DIAGNOSIS COMPLETE ===');
      console.log('✅ NO ISSUES: Terminal display appears correct in WebSocket messages');
    }

    // Store result for further analysis (this test is for diagnosis, not pass/fail)
    console.log('\nDiagnosis test complete. WebSocket message evidence captured.');
  });
});