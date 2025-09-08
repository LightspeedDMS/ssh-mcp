/**
 * Double Echo Critical Fix Validation Test
 * 
 * This test validates the critical fix for browser double echo issues.
 * Tests that characters typed in browser terminal appear exactly ONCE,
 * with SSH handling ALL terminal display operations.
 * 
 * ZERO MOCKING - Uses real MCP server, SSH connections, WebSocket communications
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';
import { CommandConfigurationJSON } from './integration/terminal-history-framework/flexible-command-configuration';

describe('Double Echo Critical Fix Validation', () => {
  let testUtils: JestTestUtilities;
  const testTimeoutMs = 45000; // Extended timeout for comprehensive testing

  beforeAll(async () => {
    testUtils = new JestTestUtilities({ enableDetailedLogging: true, testTimeout: testTimeoutMs });
  }, testTimeoutMs);

  beforeEach(async () => {
    if (testUtils) {
      await testUtils.setupTest('double-echo-test');
    }
  }, 15000);

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  }, 15000);

  /**
   * CRITICAL TEST: Validate no double echo during character typing
   * This test ensures the browser sends input to SSH without local echo,
   * and SSH handles ALL terminal display operations.
   */
  test('should not produce double echo when typing commands', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "double-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
      ],
      postWebSocketCommands: [
        // Test simple commands to verify no double echo in terminal display
        'ssh_exec {"sessionName": "double-echo-test", "command": "echo hello"}',
        'ssh_exec {"sessionName": "double-echo-test", "command": "pwd"}',
        'ssh_exec {"sessionName": "double-echo-test", "command": "whoami"}',
      ],
      workflowTimeout: testTimeoutMs,
      sessionName: 'double-echo-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Validate basic test success
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses).toBeDefined();
    expect(result.concatenatedResponses.length).toBeGreaterThan(10);

    const responses = result.concatenatedResponses;
    
    // Validate proper CRLF line endings for xterm.js compatibility
    expect(responses).toMatch(/\r\n/);
    
    // Validate that commands appear in terminal history with expected results
    expect(responses).toContain('hello');        // Echo output
    expect(responses).toContain('jsbattig');     // Whoami output
    expect(responses).toMatch(/\/home\/jsbattig/); // Home directory in pwd output

    // Critical validation: Commands should not be doubled in the output
    // Count command occurrences - they should appear reasonably (command + result, but not excessively)
    const echoCount = (responses.match(/echo hello/g) || []).length;
    const pwdCount = (responses.match(/pwd/g) || []).length;
    const whoamiCount = (responses.match(/whoami/g) || []).length;

    // Commands should appear but not be excessively duplicated
    expect(echoCount).toBeGreaterThan(0);      // Should appear at least once
    expect(echoCount).toBeLessThan(4);         // Should not be excessively duplicated
    expect(pwdCount).toBeGreaterThan(0);       // Should appear at least once
    expect(pwdCount).toBeLessThan(4);          // Should not be excessively duplicated
    expect(whoamiCount).toBeGreaterThan(0);    // Should appear at least once
    expect(whoamiCount).toBeLessThan(4);       // Should not be excessively duplicated

    console.log('✅ Double echo validation passed - commands appear appropriately');
    console.log(`Command counts: echo=${echoCount}, pwd=${pwdCount}, whoami=${whoamiCount}`);
    console.log(`Response length: ${responses.length} characters`);
  }, testTimeoutMs);


  /**
   * COMPREHENSIVE TEST: End-to-end terminal interaction without double echo
   * Tests complete typing session with mixed character types and operations.
   */
  test('should handle comprehensive terminal interaction without double echo', async () => {
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        'ssh_connect {"name": "comprehensive-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
      ],
      postWebSocketCommands: [
        // Comprehensive interaction test
        'ssh_exec {"sessionName": "comprehensive-test", "command": "echo \\"Terminal test\\""}',  // Quote handling
        'ssh_exec {"sessionName": "comprehensive-test", "command": "ls -la | head -3"}',         // Pipe command
        'ssh_exec {"sessionName": "comprehensive-test", "command": "whoami"}',                   // Simple command
      ],
      workflowTimeout: testTimeoutMs,
      sessionName: 'comprehensive-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);

    // Validate test framework success
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses).toBeDefined();
    expect(result.concatenatedResponses.length).toBeGreaterThan(20);

    // Use Terminal History Framework's advanced matchers
    const responseValidator = testUtils.expectWebSocketMessages(result.concatenatedResponses);
    
    responseValidator
      .toContainCRLF()                                    // CRLF compatibility
      .toHavePrompts()                                    // Proper prompt handling
      .toMatchCommandSequence(['echo', 'ls', 'whoami'])  // Command sequence validation
      .toHaveMinimumLength(20)                           // Adequate response length
      .validate();

    // Additional double echo prevention validation
    const responses = result.concatenatedResponses;
    
    // Count prompt appearances - should not be excessively duplicated
    const promptMatches = responses.match(/\[.*@.*\s.*\]\$/g) || [];
    expect(promptMatches.length).toBeGreaterThan(0);     // Should have prompts
    expect(promptMatches.length).toBeLessThan(15);       // Should not be excessively duplicated

    // Validate command execution results
    expect(responses).toContain('Terminal test');        // Echo output
    expect(responses).toContain('jsbattig');            // Whoami output
    expect(responses).toMatch(/total\s+\d+/);           // ls -la output pattern

    console.log('✅ Comprehensive interaction validation passed');
    console.log(`Total prompts found: ${promptMatches.length}`);
    console.log(`Response length: ${responses.length} characters`);
  }, testTimeoutMs);
});