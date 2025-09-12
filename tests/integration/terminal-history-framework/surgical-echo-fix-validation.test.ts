/**
 * Surgical Echo Fix Validation Tests - Story 03
 * 
 * TDD tests that validate the surgical echo fix implementation
 * Based on AC 3.1-3.17 from 03_Story_SurgicalEchoFix.md
 * 
 * CRITICAL: These tests should FAIL before the fix and PASS after
 * Tests use enhanced Villenele framework with browser and MCP command validation
 */

import { JestTestUtilities } from './jest-test-utilities';

describe('Surgical Echo Fix Validation', () => {
  let testUtils: JestTestUtilities;

  beforeEach(async () => {
    testUtils = new JestTestUtilities({
      enableDetailedLogging: true,
      enableErrorDiagnostics: true,
      testTimeout: 60000
    });
    await testUtils.setupTest('surgical-echo-fix-validation');
  });

  afterEach(async () => {
    if (testUtils) {
      await testUtils.cleanupTest();
    }
  });

  describe('AC 3.1-3.3: Echo Fix Implementation', () => {
    /**
     * AC 3.2: Browser command echo elimination (display exactly once)
     * This test should FAIL before fix (browser commands show double echo)
     * This test should PASS after fix (browser commands show single echo)
     */
    test('Browser commands should display echo exactly once', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "browser-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' }
        ],
        workflowTimeout: 30000,
        sessionName: 'browser-echo-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Debug: log the actual response to understand what's happening
      console.log('Browser command test result:', {
        success: result.success,
        responseLength: result.concatenatedResponses.length,
        response: result.concatenatedResponses
      });
      
      // Count occurrences of the command 'pwd' in the response
      const commandOccurrences = (result.concatenatedResponses.match(/pwd/g) || []).length;
      
      // Browser commands should show echo exactly once (not twice)
      // EXPECTED TO FAIL before fix (will show 2 occurrences)
      // EXPECTED TO PASS after fix (will show 1 occurrence)
      expect(commandOccurrences).toBe(1);
      
      // Additional validation: ensure command result is present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
    });

    /**
     * AC 3.3: MCP command echo preservation (unchanged behavior)
     * This test should PASS both before and after fix
     */
    test('MCP commands should maintain single echo behavior', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "mcp-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          'ssh_exec {"sessionName": "mcp-echo-test", "command": "pwd"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'mcp-echo-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Count occurrences of the command 'pwd' in the response
      const commandOccurrences = (result.concatenatedResponses.match(/pwd/g) || []).length;
      
      // MCP commands should always show echo exactly once
      expect(commandOccurrences).toBe(1);
      
      // Ensure command result is present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
    });
  });

  describe('AC 3.7-3.9: Enhanced Villenele Validation', () => {
    /**
     * AC 3.7: Single browser command echo validation
     */
    test('Single browser command shows consistent echo behavior', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "single-browser-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'whoami' }
        ],
        workflowTimeout: 30000,
        sessionName: 'single-browser-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Browser command should appear exactly once
      const whoamiOccurrences = (result.concatenatedResponses.match(/whoami/g) || []).length;
      expect(whoamiOccurrences).toBe(1);
      
      // Result should be present
      expect(result.concatenatedResponses).toContain('jsbattig');
    });

    /**
     * AC 3.8: Multiple browser commands echo validation
     */
    test('Multiple browser commands show consistent echo behavior', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "multiple-browser-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          { initiator: 'browser' as const, command: 'whoami' },
          { initiator: 'browser' as const, command: 'echo test-browser' }
        ],
        workflowTimeout: 45000,
        sessionName: 'multiple-browser-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Each command should appear exactly once
      const pwdOccurrences = (result.concatenatedResponses.match(/pwd/g) || []).length;
      const whoamiOccurrences = (result.concatenatedResponses.match(/whoami/g) || []).length;
      const echoOccurrences = (result.concatenatedResponses.match(/echo test-browser/g) || []).length;
      
      expect(pwdOccurrences).toBe(1);
      expect(whoamiOccurrences).toBe(1);
      expect(echoOccurrences).toBe(1);
      
      // Results should be present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      expect(result.concatenatedResponses).toContain('jsbattig');
      expect(result.concatenatedResponses).toContain('test-browser');
    });

    /**
     * AC 3.9: Mixed command scenario echo validation
     */
    test('Mixed browser and MCP commands show consistent echo behavior', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "mixed-echo-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          'ssh_exec {"sessionName": "mixed-echo-test", "command": "whoami"}',
          { initiator: 'browser' as const, command: 'echo browser-cmd' },
          'ssh_exec {"sessionName": "mixed-echo-test", "command": "echo mcp-cmd"}'
        ],
        workflowTimeout: 60000,
        sessionName: 'mixed-echo-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Each command should appear exactly once regardless of initiator
      const pwdOccurrences = (result.concatenatedResponses.match(/pwd/g) || []).length;
      const whoamiOccurrences = (result.concatenatedResponses.match(/whoami/g) || []).length;
      const browserEchoOccurrences = (result.concatenatedResponses.match(/echo browser-cmd/g) || []).length;
      const mcpEchoOccurrences = (result.concatenatedResponses.match(/echo mcp-cmd/g) || []).length;
      
      expect(pwdOccurrences).toBe(1);
      expect(whoamiOccurrences).toBe(1);
      expect(browserEchoOccurrences).toBe(1);
      expect(mcpEchoOccurrences).toBe(1);
      
      // Results should be present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      expect(result.concatenatedResponses).toContain('jsbattig');
      expect(result.concatenatedResponses).toContain('browser-cmd');
      expect(result.concatenatedResponses).toContain('mcp-cmd');
    });
  });

  describe('AC 3.4-3.6: Command State Sync Preservation', () => {
    /**
     * AC 3.4: Browser command tracking preservation
     * Verify that browser commands are still tracked by Command State Sync
     */
    test('Browser command tracking continues to work after fix', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "tracking-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          // This MCP command should be gated if browser command tracking works
          'ssh_exec {"sessionName": "tracking-test", "command": "whoami"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'tracking-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Browser command should execute and be tracked (echo fixed but tracking preserved)
      expect(result.concatenatedResponses).toContain('pwd');
      
      // MCP command should be gated due to browser command in buffer
      expect(result.concatenatedResponses).toContain('BROWSER_COMMANDS_EXECUTED');
    });

    /**
     * AC 3.5: MCP command gating preservation
     */
    test('MCP command gating continues to work after fix', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "gating-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'sleep 1' }, // Browser command to trigger gating
          'ssh_exec {"sessionName": "gating-test", "command": "pwd"}' // Should be gated
        ],
        workflowTimeout: 30000,
        sessionName: 'gating-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Browser command should execute (with fixed echo)
      const sleepOccurrences = (result.concatenatedResponses.match(/sleep 1/g) || []).length;
      expect(sleepOccurrences).toBe(1); // Fixed echo: only one occurrence
      
      // MCP command should be gated
      expect(result.concatenatedResponses).toContain('BROWSER_COMMANDS_EXECUTED');
    });

    /**
     * AC 3.6: Command cancellation preservation
     */
    test('Command cancellation continues to work after fix', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "cancellation-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'sleep 5' },
          'ssh_cancel_command {"sessionName": "cancellation-test"}'
        ],
        workflowTimeout: 20000,
        sessionName: 'cancellation-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Command should be cancelled (cancellation functionality preserved)
      expect(result.concatenatedResponses).toMatch(/cancelled|interrupt|abort|killed/i);
      
      // Echo should be fixed (only one occurrence of sleep command)
      const sleepOccurrences = (result.concatenatedResponses.match(/sleep 5/g) || []).length;
      expect(sleepOccurrences).toBe(1);
    });
  });

  describe('AC 3.10-3.12: System Preservation', () => {
    /**
     * AC 3.11: WebSocket message format preservation
     */
    test('WebSocket message format remains unchanged after fix', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "format-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' }
        ],
        workflowTimeout: 30000,
        sessionName: 'format-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // CRLF line endings should be preserved
      expect(result.concatenatedResponses).toContain('\r\n');
      
      // Bracket prompt format should be preserved
      expect(result.concatenatedResponses).toMatch(/\[jsbattig@localhost [^\]]+\]\$/);
      
      // Message structure should remain intact
      expect(result.concatenatedResponses.length).toBeGreaterThan(10);
    });

    /**
     * AC 3.12: SSH connection behavior preservation
     */
    test('SSH connection behavior remains unchanged after fix', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "ssh-behavior-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          'ssh_exec {"sessionName": "ssh-behavior-test", "command": "whoami"}'
        ],
        workflowTimeout: 30000,
        sessionName: 'ssh-behavior-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // SSH commands should execute successfully
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      expect(result.concatenatedResponses).toContain('jsbattig');
      
      // Connection should remain stable
      expect(result.success).toBe(true);
    });
  });

  describe('AC 3.13-3.17: Stability & Maintenance', () => {
    /**
     * AC 3.13: Stability and error handling validation
     */
    test('Error handling remains robust after fix', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "error-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'nonexistent-command' }
        ],
        workflowTimeout: 30000,
        sessionName: 'error-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Error should be handled gracefully
      expect(result.concatenatedResponses).toMatch(/not found|command not found|No such file/i);
      
      // Command should appear only once (echo fix maintained even for errors)
      const commandOccurrences = (result.concatenatedResponses.match(/nonexistent-command/g) || []).length;
      expect(commandOccurrences).toBe(1);
    });

    /**
     * AC 3.14: Long-term stability validation
     */
    test('Multiple consecutive browser commands maintain echo fix stability', async () => {
      const config = {
        preWebSocketCommands: [
          'ssh_connect {"name": "stability-test", "host": "localhost", "username": "jsbattig", "keyFilePath": "/home/jsbattig/.ssh/id_ed25519"}'
        ],
        postWebSocketCommands: [
          { initiator: 'browser' as const, command: 'pwd' },
          { initiator: 'browser' as const, command: 'whoami' },
          { initiator: 'browser' as const, command: 'date' },
          { initiator: 'browser' as const, command: 'echo stability-test' },
          { initiator: 'browser' as const, command: 'pwd' } // Repeat command to test consistency
        ],
        workflowTimeout: 60000,
        sessionName: 'stability-test'
      };

      const result = await testUtils.runTerminalHistoryTest(config);
      
      // Each command should appear exactly once throughout the sequence
      const pwdOccurrences = (result.concatenatedResponses.match(/pwd/g) || []).length;
      const whoamiOccurrences = (result.concatenatedResponses.match(/whoami/g) || []).length;
      const dateOccurrences = (result.concatenatedResponses.match(/date/g) || []).length;
      const echoOccurrences = (result.concatenatedResponses.match(/echo stability-test/g) || []).length;
      
      expect(pwdOccurrences).toBe(2); // pwd appears twice (executed twice)
      expect(whoamiOccurrences).toBe(1);
      expect(dateOccurrences).toBe(1);
      expect(echoOccurrences).toBe(1);
      
      // All results should be present
      expect(result.concatenatedResponses).toContain('/home/jsbattig');
      expect(result.concatenatedResponses).toContain('jsbattig');
      expect(result.concatenatedResponses).toContain('stability-test');
    });
  });
});