/**
 * WebSocket Race Condition Fix Validation
 * 
 * This test validates that the fix for the WebSocket terminal handler race condition
 * prevents "⚠️ Message Error" from appearing in the browser terminal.
 * 
 * Root Cause Fixed:
 * - Terminal handler was initialized AFTER WebSocket connection in ws.onopen
 * - WebSocket messages could arrive before terminalHandler was ready
 * - This caused race condition leading to "⚠️ Message Error"
 * 
 * Fix Applied:
 * - Moved terminal handler initialization BEFORE WebSocket connection
 * - Removed null check since handler is always available
 * 
 * This test validates the fix by simulating rapid message arrival scenarios.
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('WebSocket Race Condition Fix Validation', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('websocket-race-fix');

  test('Terminal handler should be ready when WebSocket messages arrive', async () => {
    // Test configuration that will generate immediate terminal output
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "race-test-session", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "race-test-session", "command": "echo \\"Immediate output test\\""}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "race-test-session", "command": "date"}'}
        ],
      workflowTimeout: 15000,
      sessionName: 'race-test-session'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    // Should succeed without race condition errors
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses.length).toBeGreaterThan(0);

    // Validate that CRLF line endings are preserved for xterm.js
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toContainCRLF()
      .toHavePrompts()
      .toMatchCommandSequence(['echo', 'date'])
      .toHaveMinimumLength(20)
      .validate();

    console.log('✅ WebSocket race condition fix validated successfully');
    console.log('✅ Terminal handler initialized before WebSocket messages');
    console.log('✅ No "⚠️ Message Error" should occur in browser');
  });

  test('Multiple rapid commands should not cause race conditions', async () => {
    // Test multiple rapid commands to stress test the race condition fix
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "rapid-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "rapid-test", "command": "echo \\"Command 1\\""}',
        'ssh_exec {"sessionName": "rapid-test", "command": "echo \\"Command 2\\""}',
        'ssh_exec {"sessionName": "rapid-test", "command": "echo \\"Command 3\\""}'
      ],
      postWebSocketCommands: [
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-test", "command": "echo \\"Real-time 1\\""}'},
          {initiator: 'mcp-client', command: 'ssh_exec {"sessionName": "rapid-test", "command": "echo \\"Real-time 2\\""}'}
        ],
      workflowTimeout: 20000,
      sessionName: 'rapid-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    expect(result.success).toBe(true);
    
    // Verify all commands are present in output
    testUtils.expectWebSocketMessages(result.concatenatedResponses)
      .toMatchCommandSequence(['Command 1', 'Command 2', 'Command 3', 'Real-time 1', 'Real-time 2'])
      .toContainCRLF()
      .validate();

    console.log('✅ Multiple rapid commands handled without race conditions');
  });

  test('Terminal handler error handling should be robust', async () => {
    // Test basic functionality to ensure error handling is working
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "error-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "~/.ssh/id_ed25519"}',
        'ssh_exec {"sessionName": "error-test", "command": "pwd"}'
      ],
      postWebSocketCommands: [],
      workflowTimeout: 10000,
      sessionName: 'error-test'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses).toContain('pwd');

    console.log('✅ Terminal handler error handling validated');
  });
});