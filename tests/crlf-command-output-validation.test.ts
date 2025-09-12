/**
 * CRLF Command Output Validation Test
 * 
 * This test validates that command outputs are properly terminated with CRLF
 * to prevent concatenation of command output with the next prompt.
 * 
 * Issue: Command output like "pwd" returns "/home/jsbattig" without CRLF,
 * causing the next prompt to be concatenated: "/home/jsbattig[user@host project]$"
 * 
 * Expected: "/home/jsbattig\r\n[user@host project]$"
 * 
 * This test uses the existing Terminal History Testing Framework.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('CRLF Command Output Validation - TDD', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('crlf-command-output-validation');

  it('should ensure command output is properly terminated with CRLF before next prompt', async () => {
    // ARRANGE - Configure test for specific commands that should have CRLF after output
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "crlf-validation-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        // Test specific commands that are known to cause the issue
        'ssh_exec {"sessionName": "crlf-validation-test", "command": "pwd"}',
        'ssh_exec {"sessionName": "crlf-validation-test", "command": "whoami"}',
        'ssh_exec {"sessionName": "crlf-validation-test", "command": "echo hello"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 20000,
      sessionName: 'crlf-validation-test'
    };

    console.log('🔬 Testing CRLF termination after command output...');

    try {
      // ACT - Run the terminal history test
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Critical validation for CRLF after command output
      expect(result).toBeDefined();
      
      if (result.success && result.concatenatedResponses.length > 0) {
        const terminalOutput = result.concatenatedResponses;
        console.log('📄 Terminal output for CRLF analysis:');
        console.log(JSON.stringify(terminalOutput));

        // Test 1: Validate that command outputs are properly separated with CRLF
        const hasCRLF = terminalOutput.includes('\r\n');
        expect(hasCRLF).toBe(true);
        console.log('✅ Terminal output contains CRLF sequences');

        // Test 2: Validate specific command output separation patterns
        // Look for patterns where command output should be followed by CRLF before prompt
        
        // Pattern 1: pwd command output should be followed by CRLF
        const pwdOutputPattern = /\/home\/jsbattig(?!\[)/; // pwd output not immediately followed by [
        if (terminalOutput.match(pwdOutputPattern)) {
          // If pwd output exists, check if it's properly separated
          const pwdOutputFollowedByCRLF = /\/home\/jsbattig\r\n/;
          expect(terminalOutput).toMatch(pwdOutputFollowedByCRLF);
          console.log('✅ pwd command output is properly terminated with CRLF');
        }

        // Pattern 2: whoami command output should be followed by CRLF
        const whoamiOutputPattern = /jsbattig(?!\[)/; // whoami output not immediately followed by [
        if (terminalOutput.match(whoamiOutputPattern)) {
          const whoamiOutputFollowedByCRLF = /jsbattig\r\n/;
          expect(terminalOutput).toMatch(whoamiOutputFollowedByCRLF);
          console.log('✅ whoami command output is properly terminated with CRLF');
        }

        // Pattern 3: echo command output should be followed by CRLF
        const echoOutputPattern = /hello(?!\[)/; // echo output not immediately followed by [
        if (terminalOutput.match(echoOutputPattern)) {
          const echoOutputFollowedByCRLF = /hello\r\n/;
          expect(terminalOutput).toMatch(echoOutputFollowedByCRLF);
          console.log('✅ echo command output is properly terminated with CRLF');
        }

        // Test 3: Critical test - ensure NO concatenation occurs
        // This is the core issue: output concatenated with prompt
        const concatenationPattern = /\/home\/jsbattig\[/; // pwd output directly followed by prompt
        expect(terminalOutput).not.toMatch(concatenationPattern);
        console.log('✅ No concatenation detected between command output and prompts');

        // Test 4: Validate prompt separation with CRLF  
        const promptPattern = /\[[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+\s+[^\]]+\]\$/g;
        const promptMatches = terminalOutput.match(promptPattern);
        if (promptMatches) {
          console.log(`📊 Found ${promptMatches.length} shell prompts`);
          // Each prompt should be preceded by CRLF (except the first one)
          for (let i = 1; i < promptMatches.length; i++) {
            const prompt = promptMatches[i];
            const promptIndex = terminalOutput.indexOf(prompt);
            if (promptIndex > 1) {
              // Look for CRLF before the prompt, handling potential ANSI escape sequences
              const beforePrompt = terminalOutput.substring(0, promptIndex);
              // Check that we have CRLF followed by optional ANSI escape sequences before the prompt
              // ANSI sequences can be complex: \u001b[?2004h, \u001b[0m, etc.
              const crlfWithOptionalAnsiPattern = new RegExp('\\r\\n(?:\\u001b\\[[?0-9;]*[a-zA-Z])*$');
              expect(beforePrompt).toMatch(crlfWithOptionalAnsiPattern);
              console.log(`✅ Prompt ${i + 1} is properly preceded by CRLF (with optional ANSI sequences)`);
            }
          }
        }

        console.log('🎉 ALL CRLF VALIDATIONS PASSED:');
        console.log('  ✓ Terminal output contains CRLF sequences');
        console.log('  ✓ Command outputs are properly terminated with CRLF');
        console.log('  ✓ No concatenation between command output and prompts');
        console.log('  ✓ Prompts are properly separated with CRLF');
        
      } else {
        console.log('❌ Test failed or no output captured');
        console.log('📋 Test result:', result);
        
        // Fail the test if we can't capture output
        if (result.error) {
          throw new Error(`Test execution failed: ${result.error}`);
        } else {
          throw new Error('No terminal output captured for CRLF validation');
        }
      }
      
    } catch (error) {
      console.log('❌ CRLF validation test encountered error:', error);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.log('🔍 Error details:', error.message);
        console.log('📍 Stack trace:', error.stack);
      }
      
      throw error;
    }
  }, 25000);

  it('should detect and fail on command output concatenation (reproduction test)', async () => {
    // This test is specifically designed to catch the reported issue
    // It should fail if the bug exists and pass once fixed
    
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "concatenation-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "concatenation-test", "command": "pwd"}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "concatenation-test", "command": "whoami"}'}
        ],
      workflowTimeout: 15000,
      sessionName: 'concatenation-test'
    };

    console.log('🐛 Testing for command output concatenation bug...');

    try {
      const result = await testUtils.runTerminalHistoryTest(config);
      
      if (result.success && result.concatenatedResponses.length > 0) {
        const terminalOutput = result.concatenatedResponses;
        
        console.log('🔍 Checking for concatenation patterns...');
        console.log('Raw output:', JSON.stringify(terminalOutput));
        
        // The specific bug pattern from the issue report
        const bugPattern1 = /\/home\/jsbattig\[.*@.*\s+.*\]\$/; // pwd output directly followed by bracket prompt
        const bugPattern2 = /jsbattig\[.*@.*\s+.*\]\$/; // whoami output directly followed by bracket prompt
        
        // This test should PASS when the bug is FIXED
        expect(terminalOutput).not.toMatch(bugPattern1);
        expect(terminalOutput).not.toMatch(bugPattern2);
        
        console.log('✅ No concatenation bug patterns detected');
        
        // Positive validation - ensure proper separation exists
        const properPwdSeparation = /\/home\/jsbattig\r\n.*\[.*@.*\s+.*\]\$/;
        const properWhoamiSeparation = /jsbattig\r\n.*\[.*@.*\s+.*\]\$/;
        
        if (terminalOutput.includes('/home/jsbattig')) {
          expect(terminalOutput).toMatch(properPwdSeparation);
          console.log('✅ pwd output properly separated from prompt');
        }
        
        if (terminalOutput.includes('jsbattig') && !terminalOutput.includes('jsbattig@')) {
          // Look for standalone 'jsbattig' (whoami output), not as part of 'jsbattig@host'
          const whoamiMatches = terminalOutput.match(/(?<!@)jsbattig(?!@)/g);
          if (whoamiMatches && whoamiMatches.length > 0) {
            expect(terminalOutput).toMatch(properWhoamiSeparation);
            console.log('✅ whoami output properly separated from prompt');
          }
        }
        
      } else {
        throw new Error('Failed to capture terminal output for concatenation test');
      }
      
    } catch (error) {
      console.log('❌ Concatenation test failed:', error);
      throw error;
    }
  }, 20000);
});