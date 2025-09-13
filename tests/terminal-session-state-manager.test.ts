/**
 * Terminal Session State Manager - TDD Test Suite
 * 
 * Tests the core state machine functionality that prevents command duplication
 */

import { TerminalSessionStateManager, SessionBusyError } from '../src/terminal-session-state-manager.js';
import { beforeEach, describe, it, expect } from '@jest/globals';

describe('TerminalSessionStateManager', () => {
  let stateManager: TerminalSessionStateManager;
  
  const TEST_SESSION = 'test-session';
  const TEST_COMMAND = 'echo "test"';
  const TEST_COMMAND_ID = 'cmd-123';

  beforeEach(() => {
    stateManager = new TerminalSessionStateManager();
  });

  describe('Initial State', () => {
    it('should allow commands on new sessions', () => {
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(true);
      expect(stateManager.getSessionState(TEST_SESSION)).toBe('WAITING_FOR_COMMAND');
      expect(stateManager.getCurrentCommand(TEST_SESSION)).toBeNull();
    });
  });

  describe('Command Execution State Transitions', () => {
    it('should successfully start command execution', () => {
      const result = stateManager.startCommandExecution(
        TEST_SESSION, 
        TEST_COMMAND, 
        TEST_COMMAND_ID, 
        'mcp'
      );
      
      expect(result).toBe(true);
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(false);
      expect(stateManager.getSessionState(TEST_SESSION)).toBe('EXECUTING_COMMAND');
      
      const currentCommand = stateManager.getCurrentCommand(TEST_SESSION);
      expect(currentCommand).toMatchObject({
        command: TEST_COMMAND,
        commandId: TEST_COMMAND_ID,
        initiator: 'mcp'
      });
      expect(currentCommand?.startTime).toBeGreaterThan(0);
    });

    it('should reject concurrent command execution attempts', () => {
      // Start first command
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      
      // Attempt second command should throw SessionBusyError
      expect(() => {
        stateManager.startCommandExecution(TEST_SESSION, 'echo "second"', 'cmd-456', 'browser');
      }).toThrow(SessionBusyError);
      
      // First command should still be executing
      expect(stateManager.getSessionState(TEST_SESSION)).toBe('EXECUTING_COMMAND');
      expect(stateManager.getCurrentCommand(TEST_SESSION)?.commandId).toBe(TEST_COMMAND_ID);
    });

    it('should complete command execution and reset to waiting state', () => {
      // Start command
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(false);
      
      // Complete command
      stateManager.completeCommandExecution(TEST_SESSION, TEST_COMMAND_ID);
      
      // Should return to waiting state
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(true);
      expect(stateManager.getSessionState(TEST_SESSION)).toBe('WAITING_FOR_COMMAND');
      expect(stateManager.getCurrentCommand(TEST_SESSION)).toBeNull();
    });

    it('should allow sequential command execution after completion', () => {
      // Execute first command
      stateManager.startCommandExecution(TEST_SESSION, 'echo "first"', 'cmd-1', 'mcp');
      stateManager.completeCommandExecution(TEST_SESSION, 'cmd-1');
      
      // Execute second command
      const result = stateManager.startCommandExecution(TEST_SESSION, 'echo "second"', 'cmd-2', 'browser');
      expect(result).toBe(true);
      expect(stateManager.getCurrentCommand(TEST_SESSION)?.commandId).toBe('cmd-2');
    });
  });

  describe('Multiple Sessions', () => {
    it('should manage multiple sessions independently', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      // Start command in session 1
      stateManager.startCommandExecution(session1, 'echo "s1"', 'cmd-s1', 'mcp');
      expect(stateManager.canAcceptCommand(session1)).toBe(false);
      
      // Session 2 should still be available
      expect(stateManager.canAcceptCommand(session2)).toBe(true);
      
      // Start command in session 2
      stateManager.startCommandExecution(session2, 'echo "s2"', 'cmd-s2', 'browser');
      expect(stateManager.canAcceptCommand(session2)).toBe(false);
      
      // Both sessions should be executing
      expect(stateManager.getSessionState(session1)).toBe('EXECUTING_COMMAND');
      expect(stateManager.getSessionState(session2)).toBe('EXECUTING_COMMAND');
      
      // Complete session 1 command
      stateManager.completeCommandExecution(session1, 'cmd-s1');
      expect(stateManager.canAcceptCommand(session1)).toBe(true);
      expect(stateManager.canAcceptCommand(session2)).toBe(false); // Still executing
    });
  });

  describe('Error Recovery', () => {
    it('should handle completion of unknown session gracefully', () => {
      // Should not throw error
      expect(() => {
        stateManager.completeCommandExecution('unknown-session', 'cmd-123');
      }).not.toThrow();
    });

    it('should handle command ID mismatch during completion', () => {
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      
      // Complete with wrong command ID (should not throw, but warn)
      expect(() => {
        stateManager.completeCommandExecution(TEST_SESSION, 'wrong-cmd-id');
      }).not.toThrow();
      
      // Should still reset to waiting state
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(true);
    });

    it('should force reset stuck sessions', () => {
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(false);
      
      // Force reset
      stateManager.forceResetSession(TEST_SESSION);
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(true);
      expect(stateManager.getCurrentCommand(TEST_SESSION)).toBeNull();
    });

    it('should remove session from tracking', () => {
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      
      stateManager.removeSession(TEST_SESSION);
      
      // Session should return to initial state behavior
      expect(stateManager.canAcceptCommand(TEST_SESSION)).toBe(true);
      expect(stateManager.getSessionState(TEST_SESSION)).toBe('WAITING_FOR_COMMAND');
    });
  });

  describe('Diagnostic Information', () => {
    it('should provide diagnostic information for sessions', () => {
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      
      const diagnostics = stateManager.getDiagnosticInfo();
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        sessionName: TEST_SESSION,
        state: 'EXECUTING_COMMAND',
        currentCommand: {
          command: TEST_COMMAND,
          commandId: TEST_COMMAND_ID,
          initiator: 'mcp'
        }
      });
      expect(diagnostics[0].executionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should provide empty diagnostics for no sessions', () => {
      const diagnostics = stateManager.getDiagnosticInfo();
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('SessionBusyError Details', () => {
    it('should provide detailed error information', () => {
      stateManager.startCommandExecution(TEST_SESSION, TEST_COMMAND, TEST_COMMAND_ID, 'mcp');
      
      try {
        stateManager.startCommandExecution(TEST_SESSION, 'echo "second"', 'cmd-456', 'browser');
        fail('Should have thrown SessionBusyError');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionBusyError);
        expect((error as Error).message).toContain(TEST_SESSION);
        expect((error as Error).message).toContain(TEST_COMMAND);
        expect((error as Error).message).toContain('mcp');
      }
    });
  });
});