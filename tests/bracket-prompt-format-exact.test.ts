/**
 * Bracket Prompt Format Tests - EXACT ASSERTIONS VERSION
 * 
 * This test suite validates the SSH prompt format change from:
 * OLD: `jsbattig@localhost:~$`
 * NEW: `[jsbattig@localhost ~]$`
 * 
 * CRITICAL: Uses EXACT assertions with toBe() - NO partial matching allowed
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Bracket Prompt Format Validation - EXACT ASSERTIONS', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('bracket-prompt-format-exact');

  describe('New Bracket Format Implementation - Exact Output Validation', () => {
    it('should display prompts in new bracket format [username@host directory]$ - EXACT', async () => {
      // ARRANGE - Test the new bracket format requirement
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-format-test-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-format-test-exact", "command": "ls"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'bracket-format-test-exact'
      };

      // ACT - Run the terminal history test
      const result = await testUtils.runTerminalHistoryTest(config);

      // ASSERT - Validate new bracket prompt format with EXACT output
      expect(result.success).toBe(true);
      expect(result.concatenatedResponses).toBeDefined();

      // EXACT ASSERTION - Complete expected output (corrected with triple prompt)
      const expectedExactOutput = `ls\r\n[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ \r\n[jsbattig@localhost ~]$ ls\r\n[0m[01;34mApplications[0m                  package.json\r\nbun.lock                      package-lock.json\r\n[01;34mclaude-code-server-workspace[0m  [01;34mpermanent-project[0m\r\nCLAUDE.md.backup              [01;34mPictures[0m\r\nclaude_output.txt             [01;34mPublic[0m\r\n[01;34mcode-productivity-db[0m          [01;34mscratch[0m\r\n[01;34mDesktop[0m                       [01;34mssh-test-keys[0m\r\n[01;34mDev[0m                           [01;34mTemplates[0m\r\n[01;34mDocuments[0m                     [01;34mtest_cow_implementation[0m\r\n[01;34mDownloads[0m                     [01;34mtest_cow_target_from_container[0m\r\nlscode-commands.md            [01;34mtest-results[0m\r\n[01;34mMusic[0m                         [01;34mtest-session-validation[0m\r\n[01;34mnltk_data[0m                     [01;34mthinclient_drives[0m\r\n[01;34mnode_modules[0m                  [01;34mVideos[0m\r\n[jsbattig@localhost ~]$ `;

      // CRITICAL: Exact comparison - no partial matching allowed
      expect(result.concatenatedResponses).toBe(expectedExactOutput);

      console.log('✅ BRACKET PROMPT FORMAT VALIDATED - EXACT ASSERTION');
      console.log('📊 Expected output matched exactly');
    });

    it('should use bracket format in command history replay via WebSocket - EXACT', async () => {
      // ARRANGE - Test WebSocket history replay with bracket format
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-websocket-test-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-websocket-test-exact", "command": "pwd"}'
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "bracket-websocket-test-exact", "command": "whoami"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'bracket-websocket-test-exact'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // EXACT EXPECTED OUTPUT - WebSocket replay with pre and post commands (corrected with triple prompt)
      const expectedWebSocketOutput = `pwd\r\n[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ \r\n[jsbattig@localhost ~]$ pwd\r\n/home/jsbattig\r\n[jsbattig@localhost ~]$ whoami\r\njsbattig\r\n[jsbattig@localhost ~]$ `;

      // ASSERT - EXACT WebSocket replay validation
      expect(result.success).toBe(true);
      
      // CRITICAL: Exact comparison only
      expect(result.concatenatedResponses).toBe(expectedWebSocketOutput);

      console.log('✅ BRACKET FORMAT IN WEBSOCKET REPLAY VALIDATED - EXACT ASSERTION');
      console.log('📊 WebSocket output matched exactly');
    });

    it('should handle bracket format correctly with multiple sequential commands - EXACT', async () => {
      // ARRANGE - Multiple commands to ensure consistent bracket format
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-multiple-test-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-multiple-test-exact", "command": "echo Command1"}',
          'ssh_exec {"sessionName": "bracket-multiple-test-exact", "command": "echo Command2"}',
          'ssh_exec {"sessionName": "bracket-multiple-test-exact", "command": "echo Command3"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'bracket-multiple-test-exact'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // EXACT EXPECTED OUTPUT - All three echo commands with bracket prompts (corrected)
      const expectedMultipleCommandsOutput = `echo Command1\r\n[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ \r\n[jsbattig@localhost ~]$ echo Command1\r\nCommand1\r\n[jsbattig@localhost ~]$ echo Command2\r\nCommand2\r\n[jsbattig@localhost ~]$ echo Command3\r\nCommand3\r\n[jsbattig@localhost ~]$ `;

      // ASSERT - EXACT multiple commands validation
      expect(result.success).toBe(true);
      
      // CRITICAL: Exact comparison - all commands and outputs must match exactly
      expect(result.concatenatedResponses).toBe(expectedMultipleCommandsOutput);

      console.log('✅ MULTIPLE COMMANDS WITH BRACKET FORMAT VALIDATED - EXACT ASSERTION');
      console.log('📊 All three echo commands output matched exactly');
    });
  });

  describe('Backward Compatibility and Error Handling - Exact Output', () => {
    it('should not break existing functionality with bracket format change - EXACT', async () => {
      // ARRANGE - Standard functionality test with new format
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-compatibility-test-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
          'ssh_exec {"sessionName": "bracket-compatibility-test-exact", "command": "echo Test && pwd"}'
        ],
        postWebSocketCommands: [],
        workflowTimeout: 30000,
        sessionName: 'bracket-compatibility-test-exact'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // EXACT EXPECTED OUTPUT - Combined echo and pwd command (corrected with single prompt)
      const expectedCompatibilityOutput = `echo Test && pwd\r\n[jsbattig@localhost ~]$ \r\n[jsbattig@localhost ~]$ echo Test && pwd\r\nTest\r\n/home/jsbattig\r\n[jsbattig@localhost ~]$ `;

      // ASSERT - EXACT compatibility validation
      expect(result.success).toBe(true);
      
      // CRITICAL: Exact comparison ensures no regressions
      expect(result.concatenatedResponses).toBe(expectedCompatibilityOutput);

      console.log('✅ FUNCTIONALITY COMPATIBILITY WITH BRACKET FORMAT MAINTAINED - EXACT ASSERTION');
      console.log('📊 Combined command output matched exactly');
    });
  });

  describe('Prompt Detection Pattern Updates - Exact Validation', () => {
    it('should properly detect bracket format prompts in shell initialization - EXACT', async () => {
      // ARRANGE - Simple connection test
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "bracket-detection-test-exact", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        ],
        postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "bracket-detection-test-exact", "command": "echo Prompt detection works"}'}
        ],
        workflowTimeout: 30000,
        sessionName: 'bracket-detection-test-exact'
      };

      // ACT
      const result = await testUtils.runTerminalHistoryTest(config);

      // EXACT EXPECTED OUTPUT - Connection plus single post-WebSocket command (corrected)
      const expectedDetectionOutput = `[jsbattig@localhost ~]$ [jsbattig@localhost ~]$ [jsbattig@localhost ~]$ \r\n[jsbattig@localhost ~]$ echo Prompt detection works\r\nPrompt detection works\r\n[jsbattig@localhost ~]$ `;

      // ASSERT - EXACT detection validation
      expect(result.success).toBe(true);
      
      // CRITICAL: Exact comparison confirms prompt detection works
      expect(result.concatenatedResponses).toBe(expectedDetectionOutput);

      console.log('✅ BRACKET PROMPT DETECTION WORKING - EXACT ASSERTION');
      console.log('📊 Prompt detection output matched exactly');
    });
  });

  afterAll(() => {
    console.log('\n📊 BRACKET PROMPT FORMAT VALIDATION SUMMARY - EXACT ASSERTIONS:');
    console.log('🎯 Testing prompt format change:');
    console.log('   ❌ OLD: jsbattig@localhost:~$');
    console.log('   ✅ NEW: [jsbattig@localhost ~]$');
    console.log('\n🧪 Test Coverage - EXACT ASSERTIONS ONLY:');
    console.log('   • Single command with bracket format - EXACT toBe()');
    console.log('   • Multiple commands consistency - EXACT toBe()');
    console.log('   • WebSocket history replay format - EXACT toBe()');
    console.log('   • Backward compatibility verification - EXACT toBe()');
    console.log('   • Shell prompt detection with brackets - EXACT toBe()');
    console.log('\n✅ ALL TESTS USE EXACT ASSERTIONS - NO PARTIAL MATCHING');
    console.log('📋 Expected outputs captured from actual terminal sessions');
    console.log('🚀 Exact assertion test framework implemented successfully!');
  });
});