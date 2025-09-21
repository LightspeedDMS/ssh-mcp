/**
 * Extra CRLF After Command Completion Bug Test
 *
 * This test reproduces the specific bug where an extra blank line appears
 * after command completion in browser terminals.
 *
 * BUG DESCRIPTION:
 * After commands complete, there's an extra blank line appearing:
 * ```
 * [jsbattig@localhost ~]$ pwd
 * /home/jsbattig
 * [jsbattig@localhost ~]$
 *
 * ```
 *
 * EXPECTED: Final prompt should end immediately after `[jsbattig@localhost ~]$ `
 * without the extra CRLF.
 *
 * FAILING TEST: This test should fail until the bug is fixed.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Extra CRLF After Command Completion Bug - TDD', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('extra-crlf-bug-test');

  it('should NOT have extra CRLF after command completion (TDD fix verification)', async () => {
    // ARRANGE - Simple test to verify fix for the extra CRLF bug
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "extra-crlf-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "extra-crlf-test", "command": "pwd"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 15000,
      sessionName: 'extra-crlf-test'
    };

    console.log('🐛 Testing for extra CRLF after command completion (fix verification)...');

    try {
      // ACT - Run the terminal history test
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Check for the specific extra CRLF bug
      expect(result).toBeDefined();

      if (result.success && result.concatenatedResponses.length > 0) {
        const terminalOutput = result.concatenatedResponses;
        console.log('📄 Terminal output for extra CRLF analysis:');
        console.log('Raw output:', JSON.stringify(terminalOutput));

        // Print last 20 characters with their codes to debug
        console.log('📄 Last 20 characters with codes:');
        const start = Math.max(0, terminalOutput.length - 20);
        for (let i = start; i < terminalOutput.length; i++) {
          const char = terminalOutput[i];
          const code = char.charCodeAt(0);
          console.log(`[${i}]: "${char}" (${code}) ${code === 13 ? '<CR>' : code === 10 ? '<LF>' : ''}`);
        }

        // CRITICAL TEST: Ensure final prompt does NOT have trailing CRLF
        const finalPromptPattern = /\[jsbattig@localhost ~\]\$ $/;
        expect(terminalOutput).toMatch(finalPromptPattern);
        console.log('✅ Final prompt ends correctly without extra CRLF');

        // NEGATIVE TEST: Should NOT have extra CRLF pattern
        const extraCRLFPattern = /\[jsbattig@localhost ~\]\$ \r\n$/;
        expect(terminalOutput).not.toMatch(extraCRLFPattern);
        console.log('✅ No extra CRLF pattern detected after final prompt');

        // Validate that command results still have proper CRLF
        const commandResultPattern = /\/home\/jsbattig\r\n/;
        expect(terminalOutput).toMatch(commandResultPattern);
        console.log('✅ Command results still have proper CRLF formatting');

      } else {
        console.log('❌ Test failed or no output captured');
        console.log('📋 Test result:', result);

        if (result.error) {
          throw new Error(`Test execution failed: ${result.error}`);
        } else {
          throw new Error('No terminal output captured for extra CRLF validation');
        }
      }

    } catch (error) {
      console.log('❌ Extra CRLF test encountered error:', error);

      if (error instanceof Error) {
        console.log('🔍 Error details:', error.message);
        console.log('📍 Stack trace:', error.stack);
      }

      throw error;
    }
  }, 20000);

  it('should show exact character sequence after command completion for debugging', async () => {
    // DEBUGGING TEST: Show the exact character sequence to understand the bug
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "debug-crlf-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "debug-crlf-test", "command": "echo test"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 15000,
      sessionName: 'debug-crlf-test'
    };

    console.log('🔬 Debugging exact character sequence after command completion...');

    try {
      const result = await testUtils.runTerminalHistoryTest(config);

      if (result.success && result.concatenatedResponses.length > 0) {
        const terminalOutput = result.concatenatedResponses;

        // Show every character with its code
        console.log('📄 Character-by-character analysis:');
        for (let i = 0; i < Math.min(terminalOutput.length, 200); i++) {
          const char = terminalOutput[i];
          const code = char.charCodeAt(0);
          console.log(`[${i}]: "${char}" (${code}) ${code === 13 ? '<CR>' : code === 10 ? '<LF>' : ''}`);
        }

        // Show the last 50 characters with codes
        console.log('📄 Last 50 characters analysis:');
        const start = Math.max(0, terminalOutput.length - 50);
        for (let i = start; i < terminalOutput.length; i++) {
          const char = terminalOutput[i];
          const code = char.charCodeAt(0);
          console.log(`[${i}]: "${char}" (${code}) ${code === 13 ? '<CR>' : code === 10 ? '<LF>' : ''}`);
        }

        // Count CRLF sequences
        const crlfCount = (terminalOutput.match(/\r\n/g) || []).length;
        const crCount = (terminalOutput.match(/\r/g) || []).length;
        const lfCount = (terminalOutput.match(/\n/g) || []).length;

        console.log(`📊 CRLF Statistics:`);
        console.log(`  CRLF sequences (\\r\\n): ${crlfCount}`);
        console.log(`  CR characters (\\r): ${crCount}`);
        console.log(`  LF characters (\\n): ${lfCount}`);

      } else {
        throw new Error('Failed to capture terminal output for debugging');
      }

    } catch (error) {
      console.log('❌ Debug test failed:', error);
      throw error;
    }
  }, 20000);
});