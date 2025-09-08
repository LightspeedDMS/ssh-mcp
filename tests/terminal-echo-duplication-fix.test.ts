/**
 * TDD Tests for Terminal Echo Duplication Fix
 * 
 * CRITICAL BUG REPRODUCTION:
 * These tests reproduce the command echo duplication and extra prompt issues
 * identified in the terminal display system. Tests MUST fail initially to 
 * demonstrate the bug, then pass after fix implementation.
 * 
 * Current Broken Behavior:
 * - Commands appear twice (original + SSH echo)
 * - Extra prompts appear between commands
 * 
 * Expected Correct Behavior:
 * - Commands appear exactly once
 * - Prompts appear exactly once per command
 * - Results display correctly without duplication
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

const testUtils = JestTestUtilities.setupJestEnvironment('echo-duplication-fix');

describe('Terminal Echo Duplication Fix - TDD Implementation', () => {

  /**
   * FAILING TEST 1: Single Command Echo Duplication
   * 
   * This test MUST fail initially, showing command appears twice:
   * BROKEN: "[prompt]$ whoami\r\nwhoami\r\njsbattig\r\n[prompt]$"
   * EXPECTED: "[prompt]$ whoami\r\njsbattig\r\n[prompt]$"
   */
  test('FAILING TEST: Single command should appear exactly once (no echo duplication)', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-test-single", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-test-single", "command": "whoami"}'
      ],
      workflowTimeout: 15000,
      sessionName: 'echo-test-single'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // CRITICAL ASSERTION: Command should appear exactly once
    const commandOccurrences = (result.concatenatedResponses.match(/whoami/g) || []).length;
    
    // This MUST fail initially - we expect 1 but currently get 2
    expect(commandOccurrences).toBe(1);
    
    // Verify the expected pattern (without duplication)
    const expectedPattern = /\[jsbattig@localhost [^\]]+\]\$ whoami\r\njsbattig\r\n\[jsbattig@localhost [^\]]+\]\$ /;
    expect(result.concatenatedResponses).toMatch(expectedPattern);
    
    // Ensure no duplicate command echo exists
    expect(result.concatenatedResponses).not.toMatch(/whoami\r\nwhoami/);
  });

  /**
   * FAILING TEST 2: Multi-Command Extra Prompt Duplication
   * 
   * This test MUST fail initially, showing extra prompts between commands:
   * BROKEN: "[prompt]$ cmd1\r\n...result1...\r\n[prompt]$ [prompt]$ cmd2"
   * EXPECTED: "[prompt]$ cmd1\r\n...result1...\r\n[prompt]$ cmd2"
   */
  test('FAILING TEST: Multi-command sequence should have no extra prompts', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-test-multi", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-test-multi", "command": "whoami"}',
        'ssh_exec {"sessionName": "echo-test-multi", "command": "pwd"}'
      ],
      workflowTimeout: 20000,
      sessionName: 'echo-test-multi'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // CRITICAL ASSERTION: No duplicate prompts should exist
    const duplicatePromptPattern = /\]\$ \[jsbattig@localhost/;
    
    // This MUST fail initially - duplicate prompts currently exist
    expect(result.concatenatedResponses).not.toMatch(duplicatePromptPattern);
    
    // Verify commands appear exactly once each
    const whoamiCount = (result.concatenatedResponses.match(/whoami/g) || []).length;
    const pwdCount = (result.concatenatedResponses.match(/pwd/g) || []).length;
    
    expect(whoamiCount).toBe(1);
    expect(pwdCount).toBe(1);
    
    // Verify expected clean pattern for multi-command
    const cleanPattern = /\[jsbattig@localhost [^\]]+\]\$ whoami\r\njsbattig\r\n\[jsbattig@localhost [^\]]+\]\$ pwd\r\n\/[^\r\n]+\r\n\[jsbattig@localhost [^\]]+\]\$ /;
    expect(result.concatenatedResponses).toMatch(cleanPattern);
  });

  /**
   * FAILING TEST 3: Command Results Preservation
   * 
   * While fixing echo duplication, ensure command results still appear correctly
   */
  test('FAILING TEST: Command results must be preserved during echo fix', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-test-results", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-test-results", "command": "echo test-result-preservation"}'
      ],
      workflowTimeout: 15000,
      sessionName: 'echo-test-results'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // Verify command appears exactly once
    const echoCommandPattern = /echo test-result-preservation/g;
    const commandCount = (result.concatenatedResponses.match(echoCommandPattern) || []).length;
    expect(commandCount).toBe(1);
    
    // Verify result appears as expected: once in command, once as output
    // Pattern: "[prompt]$ echo test-result-preservation\r\ntest-result-preservation\r\n[prompt]$"
    const expectedResultPattern = /\[jsbattig@localhost [^\]]+\]\$ echo test-result-preservation\r\ntest-result-preservation\r\n\[jsbattig@localhost [^\]]+\]\$ /;
    expect(result.concatenatedResponses).toMatch(expectedResultPattern);
    
    // Verify no duplicate command echo exists
    expect(result.concatenatedResponses).not.toMatch(/echo test-result-preservation\r\necho test-result-preservation/);
    
    // Ensure CRLF preservation
    expect(result.concatenatedResponses).toContain('\r\n');
  });

  /**
   * FAILING TEST 4: First Prompt Issue Must Remain Fixed
   * 
   * Ensure the previous fix for missing first prompt doesn't regress
   * while fixing echo duplication
   */
  test('FAILING TEST: First prompt must appear while fixing echo duplication', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-test-first-prompt", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "echo-test-first-prompt", "command": "whoami"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 15000,
      sessionName: 'echo-test-first-prompt'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // Verify first prompt exists
    const firstPromptPattern = /^\[jsbattig@localhost [^\]]+\]\$ /;
    expect(result.concatenatedResponses).toMatch(firstPromptPattern);
    
    // Verify no echo duplication even with pre-WebSocket commands
    const commandCount = (result.concatenatedResponses.match(/whoami/g) || []).length;
    expect(commandCount).toBe(1);
  });

  /**
   * FAILING TEST 5: Complex Multi-Command Scenario
   * 
   * Test complex scenario with multiple commands to ensure comprehensive fix
   */
  test('FAILING TEST: Complex multi-command scenario without any duplication', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "echo-test-complex", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "echo-test-complex", "command": "pwd"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "echo-test-complex", "command": "whoami"}',
        'ssh_exec {"sessionName": "echo-test-complex", "command": "echo complex-test"}'
      ],
      workflowTimeout: 25000,
      sessionName: 'echo-test-complex'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // Verify each command appears exactly once
    expect((result.concatenatedResponses.match(/pwd/g) || []).length).toBe(1);
    expect((result.concatenatedResponses.match(/whoami/g) || []).length).toBe(1);
    expect((result.concatenatedResponses.match(/echo complex-test/g) || []).length).toBe(1);
    
    // Verify no duplicate prompts exist anywhere
    expect(result.concatenatedResponses).not.toMatch(/\]\$ \[jsbattig@localhost/);
    
    // Verify results appear
    expect(result.concatenatedResponses).toContain('jsbattig');
    expect(result.concatenatedResponses).toContain('complex-test');
    
    // Verify CRLF preservation throughout
    const crlfCount = (result.concatenatedResponses.match(/\r\n/g) || []).length;
    expect(crlfCount).toBeGreaterThan(5); // Multiple lines should have CRLF
  });
});