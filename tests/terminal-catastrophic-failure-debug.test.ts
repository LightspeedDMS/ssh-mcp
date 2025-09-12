/**
 * Terminal Catastrophic Failure Debug Test
 * 
 * Using Villenele framework to capture and analyze complete terminal failure:
 * 1. No typing echo - user can't see what they type
 * 2. Double command echo - commands appear twice  
 * 3. Mangled output formatting - weird spacing and corruption
 * 4. Architectural protocol failures
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Terminal Catastrophic Failure Debug', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('terminal-catastrophic-failure-debug');

  it('should capture exact failure patterns with typing and echo issues', async () => {
    // Test configuration to reproduce the exact failure scenario
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        // Type "ls" command to test typing echo and command execution
        'ssh_exec {"sessionName": "debug-session", "command": "ls"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'debug-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Capture exact WebSocket messages for analysis
    console.log('=== EXACT WEBSOCKET MESSAGES ===');
    console.log('Length:', result.concatenatedResponses.length);
    
    // Split messages to analyze each one
    const messages = result.concatenatedResponses.split(/(?=\[jsbattig@localhost)/);
    
    messages.forEach((msg, idx) => {
      console.log(`\n--- Message ${idx + 1} ---`);
      // Show with visible control characters
      console.log('Raw:', JSON.stringify(msg));
      console.log('Clean:', msg);
      
      // Check for specific failure patterns
      if (msg.includes('ls')) {
        console.log('FOUND "ls" command in message');
        
        // Count occurrences of "ls" to detect double echo
        const lsCount = (msg.match(/\bls\b/g) || []).length;
        console.log(`"ls" appears ${lsCount} times`);
        
        if (lsCount > 1) {
          console.log('❌ DOUBLE ECHO DETECTED!');
        }
      }
      
      // Check for mangled spacing (20+ spaces indicates a problem, 8 is a normal tab)
      const weirdSpacing = /\s{20,}/.test(msg);
      if (weirdSpacing) {
        console.log('❌ MANGLED SPACING DETECTED!');
        // Show where the excessive spacing is
        const matches = msg.match(/[^\s]+\s{20,}[^\s]+/g);
        if (matches) {
          console.log('Excessive spacing found in:', matches[0]);
        }
      }
    });

    // Analyze terminal protocol issues
    console.log('\n=== TERMINAL PROTOCOL ANALYSIS ===');
    
    // Check for CRLF line endings (required for xterm.js)
    const hasCRLF = result.concatenatedResponses.includes('\r\n');
    console.log('Has CRLF endings:', hasCRLF);
    
    // Check for command echo patterns
    const commandEchoPattern = /\$ ls\r?\n/;
    const hasCommandEcho = commandEchoPattern.test(result.concatenatedResponses);
    console.log('Has command echo after prompt:', hasCommandEcho);
    
    // Check for duplicate command output
    const outputLines = result.concatenatedResponses.split(/\r?\n/);
    const lsOutputPattern = /Applications|package\.json|bun\.lock/;
    const lsOutputLines = outputLines.filter(line => lsOutputPattern.test(line));
    console.log('Number of lines with ls output:', lsOutputLines.length);
    
    if (lsOutputLines.length > 1) {
      console.log('❌ DUPLICATE OUTPUT DETECTED!');
      lsOutputLines.forEach((line, idx) => {
        console.log(`  Output ${idx + 1}:`, line.substring(0, 100));
      });
    }

    // Check for prompt patterns
    const promptPattern = /\[jsbattig@localhost[^\]]*\]\$/g;
    const prompts = result.concatenatedResponses.match(promptPattern) || [];
    console.log('Number of prompts found:', prompts.length);
    prompts.forEach((prompt, idx) => {
      console.log(`  Prompt ${idx + 1}:`, prompt);
    });

    // Precise assertions to validate failures
    
    // 1. Check for typing echo (should see "ls" after prompt)
    const typingEchoPattern = /\]\$ ls/;
    const hasTypingEcho = typingEchoPattern.test(result.concatenatedResponses);
    
    // 2. Check for double command echo
    const commandOccurrences = (result.concatenatedResponses.match(/\bls\b/g) || []).length;
    const hasDoubleEcho = commandOccurrences > 1;
    
    // 3. Check for mangled output (excessive spacing)
    const hasMangledOutput = /\s{20,}/.test(result.concatenatedResponses);
    
    // 4. Check for proper CRLF endings
    const hasProperLineEndings = result.concatenatedResponses.includes('\r\n');

    // Report findings
    console.log('\n=== FAILURE ANALYSIS SUMMARY ===');
    console.log('1. Typing Echo Present:', hasTypingEcho, hasTypingEcho ? '✅' : '❌ MISSING');
    console.log('2. Double Command Echo:', hasDoubleEcho, hasDoubleEcho ? '❌ FAILURE' : '✅');
    console.log('3. Mangled Output:', hasMangledOutput, hasMangledOutput ? '❌ FAILURE' : '✅');
    console.log('4. CRLF Line Endings:', hasProperLineEndings, hasProperLineEndings ? '✅' : '❌ MISSING');

    // These assertions will help identify the exact failures
    expect(hasTypingEcho).toBe(true); // Should see typed command
    expect(hasDoubleEcho).toBe(false); // Should not have double echo
    expect(hasMangledOutput).toBe(false); // Should not have mangled spacing
    expect(hasProperLineEndings).toBe(true); // Should have CRLF for xterm.js
  });

  it('should analyze terminal input handler behavior', async () => {
    // This test specifically checks the browser-side terminal input handling
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "input-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        // Send multiple commands to test input handling
        'ssh_exec {"sessionName": "input-test", "command": "echo test1"}',
        'ssh_exec {"sessionName": "input-test", "command": "echo test2"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'input-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    console.log('\n=== INPUT HANDLER ANALYSIS ===');
    
    // Check for echo patterns in each command
    const echoTest1Pattern = /echo test1/g;
    const echoTest1Count = (result.concatenatedResponses.match(echoTest1Pattern) || []).length;
    console.log('Occurrences of "echo test1":', echoTest1Count);
    
    const echoTest2Pattern = /echo test2/g;
    const echoTest2Count = (result.concatenatedResponses.match(echoTest2Pattern) || []).length;
    console.log('Occurrences of "echo test2":', echoTest2Count);
    
    // Check for command results
    const test1ResultPattern = /test1(?!\s*echo)/; // test1 not followed by echo
    const hasTest1Result = test1ResultPattern.test(result.concatenatedResponses);
    console.log('Has test1 result:', hasTest1Result);
    
    const test2ResultPattern = /test2(?!\s*echo)/; // test2 not followed by echo
    const hasTest2Result = test2ResultPattern.test(result.concatenatedResponses);
    console.log('Has test2 result:', hasTest2Result);

    // Terminal protocol check - look for specific patterns
    const lines = result.concatenatedResponses.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.includes('echo') || line.includes('test')) {
        console.log(`Line ${idx}:`, JSON.stringify(line));
      }
    });

    // Assertions
    expect(echoTest1Count).toBe(1); // Command should appear once
    expect(echoTest2Count).toBe(1); // Command should appear once
    expect(hasTest1Result).toBe(true); // Should see result
    expect(hasTest2Result).toBe(true); // Should see result
  });
});