/**
 * Simple Sequential Debug Test
 * 
 * PURPOSE: Simple test to debug sequential command execution with detailed logging
 */

import { JestTestUtilities } from './integration/terminal-history-framework/jest-test-utilities';

describe('Simple Sequential Debug', () => {
  const testUtils = JestTestUtilities.setupJestEnvironment('simple-sequential-debug');

  /**
   * Single command test - should work
   */
  it('should execute single command successfully', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "single-cmd", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "single-cmd", "command": "echo single-success"}'
      ],
      workflowTimeout: 15000,
      sessionName: 'single-cmd'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('=== SINGLE COMMAND RESULT ===');
    console.log('Success:', result.success);
    console.log('Response:', result.concatenatedResponses);
    console.log('Post-WebSocket results:', result.postWebSocketResults);
    
    expect(result.success).toBe(true);
    expect(result.concatenatedResponses).toContain('single-success');
  });

  /**
   * Two command test - second should fail/timeout
   */
  it('should demonstrate two command execution issue', async () => {
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "dual-cmd", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "dual-cmd", "command": "echo first-cmd"}',
        'ssh_exec {"sessionName": "dual-cmd", "command": "echo second-cmd"}'
      ],
      workflowTimeout: 20000,
      sessionName: 'dual-cmd'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('=== DUAL COMMAND RESULT ===');
    console.log('Success:', result.success);
    console.log('Response:', result.concatenatedResponses);
    console.log('Post-WebSocket results count:', result.postWebSocketResults?.length || 0);
    
    if (result.postWebSocketResults) {
      result.postWebSocketResults.forEach((cmdResult, index) => {
        console.log(`Command ${index + 1}:`, {
          command: cmdResult.command,
          success: cmdResult.success,
          error: cmdResult.error,
          executionTime: cmdResult.executionEndTime - cmdResult.executionStartTime
        });
      });
    }
    
    // Document the current broken behavior
    expect(result.concatenatedResponses).toContain('first-cmd');
    
    // This will likely fail - second command doesn't execute
    try {
      expect(result.concatenatedResponses).toContain('second-cmd');
    } catch (error) {
      console.log('EXPECTED FAILURE: Second command not found in response');
      console.log('Error:', error instanceof Error ? error.message : String(error));
      throw error; // Re-throw to show test failure
    }
  });

  /**
   * Test with longer delays between commands
   */
  it('should test if longer delays fix the issue', async () => {
    // This test uses a custom configuration that might have longer delays
    const config = {
      preWebSocketCommands: [
        'ssh_connect {"name": "delayed-cmd", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
      ],
      postWebSocketCommands: [
        'ssh_exec {"sessionName": "delayed-cmd", "command": "echo delay-first && sleep 2"}',
        'ssh_exec {"sessionName": "delayed-cmd", "command": "echo delay-second"}'
      ],
      workflowTimeout: 30000,
      sessionName: 'delayed-cmd'
    };

    const result = await testUtils.runTerminalHistoryTest(config);
    
    console.log('=== DELAYED COMMAND RESULT ===');
    console.log('Success:', result.success);
    console.log('Response preview:', result.concatenatedResponses.substring(0, 200));
    
    // Test if adding sleep helps the second command execute
    expect(result.concatenatedResponses).toContain('delay-first');
    expect(result.concatenatedResponses).toContain('delay-second');
  });
});