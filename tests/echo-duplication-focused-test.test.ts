/**
 * Focused Echo Duplication Test - TDD Implementation
 * 
 * CRITICAL: This test reproduces the echo duplication issue with minimal setup
 * to understand the exact nature of the problem
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Echo Duplication Focused Test', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: false,
      enableErrorDiagnostics: true,
      testTimeout: 60000
    });
    await testUtils.setupTest('echo-duplication-focused');
  });

  afterEach(async () => {
    await testUtils.cleanupTest();
  });

  test('should reproduce echo duplication with single command', async () => {
    const sessionName = 'echo-test-single';
    const testCommand = 'pwd';

    const testConfig = {
      preWebSocketCommands: [
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}`
      ],
      postWebSocketCommands: [
        { initiator: 'browser' as const, command: testCommand }
      ],
      workflowTimeout: 30000,
      sessionName
    };

    const result = await testUtils.runTerminalHistoryTest(testConfig);
    
    console.log('=== ECHO DUPLICATION DEBUG ===');
    console.log('Full response:');
    console.log(result.concatenatedResponses);
    console.log('==============================');
    
    // Show hex representation to see exact characters
    console.log('Hex representation:');
    const hex = Buffer.from(result.concatenatedResponses, 'utf8').toString('hex');
    console.log(hex);
    console.log('==============================');
    
    // Split response into lines for analysis
    const responseLines = result.concatenatedResponses.split('\n');
    console.log('Response lines:', responseLines.length);
    
    // Count exact command occurrences
    const commandOccurrences = responseLines
      .filter(line => line.trim() === testCommand.trim())
      .length;
    
    console.log(`Command "${testCommand}" appears ${commandOccurrences} times`);
    
    // Show lines containing the command
    const commandLines = responseLines
      .map((line, index) => ({ line: line.trim(), index }))
      .filter(item => item.line === testCommand.trim());
    
    console.log('Lines containing command:', commandLines);

    // Analyze the actual problem in detail
    console.log('\n=== DETAILED ANALYSIS ===');
    responseLines.forEach((line, i) => {
      console.log(`Line ${i}: "${line}"`);
    });
    
    // The real issue: command result is treated as a command
    const problematicLine = responseLines.find(line => line.includes('[jsbattig@localhost ~]$ /home/jsbattig'));
    if (problematicLine) {
      console.log('\n🚨 FOUND THE PROBLEM: Command result treated as command input!');
      console.log(`Problematic line: "${problematicLine}"`);
    }
    
    // Check for trailing command duplication
    const trailingCommand = responseLines[responseLines.length - 2]; // Second to last line
    if (trailingCommand && trailingCommand.trim() === testCommand) {
      console.log('\n🚨 FOUND TRAILING DUPLICATION: Command appears at end without prompt!');
      console.log(`Trailing command: "${trailingCommand}"`);
    }

    // ECHO DUPLICATION FIX VERIFICATION:
    // The trailing command duplication has been fixed!
    // Command now only appears in prompt context, not as standalone line
    
    // Count total occurrences of "pwd" anywhere in output
    const totalPwdOccurrences = (result.concatenatedResponses.match(/pwd/g) || []).length;
    console.log(`Total "pwd" occurrences: ${totalPwdOccurrences}`);
    
    // Verify the command appears exactly once (in the prompt)
    expect(totalPwdOccurrences).toBe(1);
    
    // Verify no trailing command duplication (standalone command lines)
    expect(commandOccurrences).toBe(0); // No standalone "pwd" lines
  });
});