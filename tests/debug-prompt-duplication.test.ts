/**
 * Debug Prompt Duplication Issue
 * 
 * The OSC fix is working, but we have prompt duplication:
 * "jsbattig@localhost:~[jsbattig@localhost ~]$ jsbattig@localhost:~[jsbattig@localhost ~]$ \r\ntesting terminal fix\r\n"
 * 
 * This test will help identify why prompts are appearing twice.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { CommandConfigurationJSON } from './integration/terminal-history-framework/flexible-command-configuration';

describe('Debug Prompt Duplication', () => {
  let testUtils: JestTestUtilities;
  
  beforeAll(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 30000
    });
  });

  beforeEach(async () => {
    await testUtils.setupTest('debug-prompt-duplication');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  test('should analyze prompt duplication pattern in detail', async () => {
    console.log('\n=== DEBUG PROMPT DUPLICATION ===');
    
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-prompts", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        // Just one simple command to analyze the pattern
        'ssh_exec {"sessionName": "debug-prompts", "command": "echo \\"test\\""}',
      ],
      postWebSocketCommands: [],
      workflowTimeout: 25000,
      sessionName: 'debug-prompts'
    };

    const workflowResult = await testUtils.runTerminalHistoryTest(config);
    
    expect(workflowResult.success).toBe(true);
    
    const rawMessages = workflowResult.concatenatedResponses!;
    console.log('\n=== RAW MESSAGE ANALYSIS ===');
    console.log(`Full message: "${rawMessages}"`);
    console.log(`Message length: ${rawMessages.length}`);
    
    // Split into lines for detailed analysis
    const lines = rawMessages.split('\r\n');
    console.log('\n=== LINE-BY-LINE BREAKDOWN ===');
    lines.forEach((line, index) => {
      console.log(`Line ${index}: "${line}"`);
    });
    
    // Look for prompt patterns
    console.log('\n=== PROMPT PATTERN ANALYSIS ===');
    const promptPattern = /jsbattig@localhost:[^$]*\$|jsbattig@localhost[^\]]*\]\$/g;
    const allPrompts = rawMessages.match(promptPattern) || [];
    console.log(`Total prompts found: ${allPrompts.length}`);
    allPrompts.forEach((prompt, index) => {
      console.log(`Prompt ${index + 1}: "${prompt}"`);
    });
    
    // Check for specific duplicate patterns
    console.log('\n=== DUPLICATION ANALYSIS ===');
    const duplicatePattern = /(\[[^\]]+\]\$)\s*(\[[^\]]+\]\$)/g;
    const duplicates = rawMessages.match(duplicatePattern) || [];
    console.log(`Duplicate prompt patterns: ${duplicates.length}`);
    duplicates.forEach((duplicate, index) => {
      console.log(`Duplicate ${index + 1}: "${duplicate}"`);
    });
    
    // Look for the exact pattern from our test failure
    const exactDuplicationPattern = /jsbattig@localhost:~\[jsbattig@localhost ~\]\$ jsbattig@localhost:~\[jsbattig@localhost ~\]\$/g;
    const exactDuplicates = rawMessages.match(exactDuplicationPattern) || [];
    console.log(`\n=== EXACT DUPLICATION MATCHES ===`);
    console.log(`Exact duplicate patterns: ${exactDuplicates.length}`);
    exactDuplicates.forEach((match, index) => {
      console.log(`Exact duplicate ${index + 1}: "${match}"`);
    });
    
    console.log('\n=== DIAGNOSIS COMPLETE ===');
    console.log('This will help identify where the prompt duplication occurs.');
  });
});