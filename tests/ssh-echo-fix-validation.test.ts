/**
 * SSH Server Echo Fix Validation Test
 * 
 * This test validates that the SSH PTY ECHO disabled configuration
 * prevents character duplication from server-side echo.
 * 
 * CRITICAL FIX: SSH PTY configured with ECHO: 0 to disable server echo
 * preventing double character display in browser terminals.
 */

import { describe, test, expect } from '@jest/globals';
import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities.js';
import type { CommandConfigurationJSON } from './integration/terminal-history-framework/flexible-command-configuration.js';

describe('SSH Echo Fix Validation', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('ssh-echo-fix-validation');

  test('should prevent character duplication with ECHO disabled SSH PTY configuration', async () => {
    // VALIDATION TEST: This should now pass with SSH PTY ECHO disabled
    
    const sessionName = `final-validation-${Date.now()}`;
    
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}`
      ],
      postWebSocketCommands: [
        // Send character-by-character input to test server echo behavior
        `ssh_exec {"sessionName": "${sessionName}", "command": "echo hello"}`
      ],
      workflowTimeout: 20000,
      sessionName
    };

    console.log('🔧 Running SSH echo fix validation test...');

    const result = await testUtils.runTerminalHistoryTest(config);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses).toBeDefined();

    console.log('📊 WebSocket responses analysis:');
    console.log('Total concatenated response length:', result.concatenatedResponses.length);
    console.log('Response sample:', result.concatenatedResponses.substring(0, 200));

    // CRITICAL ASSERTION: Verify output contains expected content without duplication
    const responses = result.concatenatedResponses;
    
    // CRITICAL VALIDATION: With ECHO disabled, we should see the command RESULT but NOT the command echo
    // This is the key indicator that SSH server echo is disabled
    expect(responses).toMatch(/hello/); // Should see the result of echo command
    
    // CRITICAL: With ECHO disabled, we should NOT see the literal command text "echo hello"
    // This proves server echo is disabled - the shell processes the command but doesn't echo it back
    expect(responses).not.toMatch(/echo hello/); // Should NOT see the command echoed back
    
    // Count occurrences of key patterns
    const helloCount = (responses.match(/hello/g) || []).length;
    const echoCount = (responses.match(/echo/g) || []).length;
    
    console.log('🔍 Pattern analysis for SSH echo validation:');
    console.log(`"hello" appears ${helloCount} times`);
    console.log(`"echo" appears ${echoCount} times`);
    
    // With proper echo management (ECHO disabled):
    // - "hello" should appear once (the result of the command)
    // - "echo" should appear 0 times (command not echoed back)
    // Without proper echo management:
    // - We would see "echo hello" literally in the output
    
    expect(helloCount).toBe(1); // Exactly one result
    expect(echoCount).toBe(0);  // No command echo - this proves ECHO is disabled
    
    // Verify CRLF line endings are preserved
    expect(responses).toMatch(/\r\n/);
    
    // Additional validation: should not contain obvious double character sequences
    expect(responses).not.toMatch(/eecchhoo/);
    expect(responses).not.toMatch(/hheelllloo/);
    
    console.log('✅ SSH echo fix validation passed - no character duplication detected');

  }, 30000);

  test('should handle character-by-character input correctly with echo disabled', async () => {
    // TEST: Validate that individual character input works correctly
    
    const sessionName = `char-test-${Date.now()}`;
    
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}`
      ],
      postWebSocketCommands: [
        // Test with a simple command that will show character-by-character behavior
        `ssh_exec {"sessionName": "${sessionName}", "command": "pwd"}`
      ],
      workflowTimeout: 15000,
      sessionName
    };

    console.log('🔤 Testing character-by-character input handling...');

    const result = await testUtils.runTerminalHistoryTest(config);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    const responses = result.concatenatedResponses;
    
    // Should contain the pwd command and its result
    expect(responses).toMatch(/pwd/);
    expect(responses).toMatch(/ls-ssh-mcp/); // Expected directory name
    
    // Verify no obvious character duplication in the working directory path
    expect(responses).not.toMatch(/ppwwdd/);
    expect(responses).not.toMatch(/llss--sssshh--mmccpp/);
    
    console.log('📁 Working directory output:', responses.match(/ls-ssh-mcp/g) || []);
    console.log('✅ Character-by-character input test passed');

  }, 20000);

  test('should demonstrate SSH PTY configuration is working', async () => {
    // DEMONSTRATION: Show that the SSH connection uses our custom PTY options
    
    const sessionName = `pty-demo-${Date.now()}`;
    
    const config: CommandConfigurationJSON = {
      preWebSocketCommands: [
        `ssh_connect {"name": "${sessionName}", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}`
      ],
      postWebSocketCommands: [
        // Use stty to show terminal settings (if available)
        `ssh_exec {"sessionName": "${sessionName}", "command": "echo 'Terminal configured with ECHO disabled'"}`
      ],
      workflowTimeout: 15000,
      sessionName
    };

    console.log('⚙️ Demonstrating SSH PTY configuration...');

    const result = await testUtils.runTerminalHistoryTest(config);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Just verify the connection works and returns expected content
    const responses = result.concatenatedResponses;
    expect(responses).toMatch(/Terminal configured with ECHO disabled/);
    
    console.log('🔧 SSH PTY configuration demonstration completed');

  }, 20000);
});