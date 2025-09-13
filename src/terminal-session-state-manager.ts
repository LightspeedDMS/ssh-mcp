/**
 * Terminal Session State Manager
 * 
 * CRITICAL PURPOSE: Prevent command execution duplication between MCP and browser paths
 * 
 * FUNDAMENTAL PROBLEM SOLVED:
 * - MCP path: handleSSHExec() → sshManager.executeCommand()  
 * - Browser path: handleTerminalInputMessage() → sshManager.executeCommand()
 * - BOTH paths execute on same SSH session causing duplication
 * 
 * SOLUTION: Simple state machine with SINGLE execution path control
 */

import { Logger, log } from './logger.js';

/**
 * Current command execution context
 */
interface CurrentCommand {
  command: string;
  commandId: string;
  initiator: 'mcp' | 'browser';
  startTime: number;
}

/**
 * Terminal session state representation
 */
interface TerminalSessionState {
  sessionName: string;
  state: 'WAITING_FOR_COMMAND' | 'EXECUTING_COMMAND';
  currentCommand?: CurrentCommand;
}

/**
 * State transition validation errors
 */
export class SessionBusyError extends Error {
  constructor(sessionName: string, currentCommand: CurrentCommand) {
    super(`Session '${sessionName}' is busy executing command: ${currentCommand.command} (initiated by ${currentCommand.initiator})`);
    this.name = 'SessionBusyError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionName: string) {
    super(`Session '${sessionName}' not found in state manager`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Terminal Session State Manager
 * 
 * Implements simple state machine to prevent command execution duplication:
 * - WAITING_FOR_COMMAND: Can accept new commands
 * - EXECUTING_COMMAND: Rejects new commands until completion
 * 
 * GOLDEN RULE: Only ONE command executes at a time per session
 */
export class TerminalSessionStateManager {
  private sessionStates = new Map<string, TerminalSessionState>();

  constructor() {
    // Initialize logger for state management - use null for testing environments
    if (!Logger.getInstance()) {
      Logger.initialize('null', 'TerminalStateManager');
    }
  }

  /**
   * Start command execution transition
   * 
   * @param sessionName - SSH session identifier
   * @param command - Command to execute
   * @param commandId - Unique command identifier  
   * @param initiator - Source of command ('mcp' | 'browser')
   * @returns true if command can start, false if session busy
   * @throws SessionBusyError if session is already executing command
   */
  startCommandExecution(
    sessionName: string, 
    command: string, 
    commandId: string, 
    initiator: 'mcp' | 'browser'
  ): boolean {
    const sessionState = this.getOrCreateSessionState(sessionName);
    
    // Check if session can accept new commands
    if (sessionState.state === 'EXECUTING_COMMAND') {
      if (sessionState.currentCommand) {
        throw new SessionBusyError(sessionName, sessionState.currentCommand);
      } else {
        // CRITICAL: Fail fast on corrupted state instead of silent recovery
        throw new Error(`CRITICAL: Session ${sessionName} in corrupted state - EXECUTING_COMMAND with no currentCommand`);
      }
    }
    
    // Transition to executing state
    sessionState.state = 'EXECUTING_COMMAND';
    sessionState.currentCommand = {
      command,
      commandId,
      initiator,
      startTime: Date.now()
    };
    
    log.debug(`Session ${sessionName}: Started executing command "${command}" (${commandId}) from ${initiator}`);
    return true;
  }

  /**
   * Complete command execution transition
   * 
   * @param sessionName - SSH session identifier
   * @param commandId - Command identifier that completed
   */
  completeCommandExecution(sessionName: string, commandId: string): void {
    const sessionState = this.sessionStates.get(sessionName);
    
    if (!sessionState) {
      log.warn(`Attempted to complete command ${commandId} for unknown session: ${sessionName}`);
      return;
    }
    
    // Verify command ID matches current command
    if (sessionState.currentCommand?.commandId !== commandId) {
      // CRITICAL: Fail fast on command ID mismatch instead of continuing
      throw new Error(`Command ID mismatch: expected ${sessionState.currentCommand?.commandId}, got ${commandId}`);
    }
    
    // Transition to waiting state
    const completedCommand = sessionState.currentCommand;
    sessionState.state = 'WAITING_FOR_COMMAND';
    sessionState.currentCommand = undefined;
    
    if (completedCommand) {
      const executionTime = Date.now() - completedCommand.startTime;
      log.debug(`Session ${sessionName}: Completed command "${completedCommand.command}" (${commandId}) in ${executionTime}ms`);
    }
  }

  /**
   * Check if session can accept new commands
   * 
   * @param sessionName - SSH session identifier
   * @returns true if session can accept commands
   */
  canAcceptCommand(sessionName: string): boolean {
    const sessionState = this.sessionStates.get(sessionName);
    
    // Unknown sessions can accept commands (will be created)
    if (!sessionState) {
      return true;
    }
    
    return sessionState.state === 'WAITING_FOR_COMMAND';
  }

  /**
   * Get current executing command for session
   * 
   * @param sessionName - SSH session identifier
   * @returns Current command or null if none executing
   */
  getCurrentCommand(sessionName: string): CurrentCommand | null {
    const sessionState = this.sessionStates.get(sessionName);
    return sessionState?.currentCommand || null;
  }

  /**
   * Get current session state
   * 
   * @param sessionName - SSH session identifier
   * @returns Current state
   */
  getSessionState(sessionName: string): 'WAITING_FOR_COMMAND' | 'EXECUTING_COMMAND' {
    const sessionState = this.sessionStates.get(sessionName);
    return sessionState?.state || 'WAITING_FOR_COMMAND';
  }

  /**
   * Get or create session state
   */
  private getOrCreateSessionState(sessionName: string): TerminalSessionState {
    let sessionState = this.sessionStates.get(sessionName);
    
    if (!sessionState) {
      sessionState = {
        sessionName,
        state: 'WAITING_FOR_COMMAND',
        currentCommand: undefined
      };
      this.sessionStates.set(sessionName, sessionState);
      log.debug(`Created new session state for: ${sessionName}`);
    }
    
    return sessionState;
  }

  /**
   * Remove session from state tracking
   * Used when SSH session is disconnected
   * 
   * @param sessionName - SSH session identifier
   */
  removeSession(sessionName: string): void {
    const removed = this.sessionStates.delete(sessionName);
    if (removed) {
      log.debug(`Removed session state for: ${sessionName}`);
    }
  }

  /**
   * Force reset session to waiting state
   * Used for emergency recovery from stuck states
   * 
   * @param sessionName - SSH session identifier
   */
  forceResetSession(sessionName: string): void {
    const sessionState = this.sessionStates.get(sessionName);
    if (sessionState) {
      sessionState.state = 'WAITING_FOR_COMMAND';
      sessionState.currentCommand = undefined;
      log.warn(`Force reset session state for: ${sessionName}`);
    }
  }

  /**
   * Get diagnostic information for all sessions
   * Used for debugging and monitoring
   */
  getDiagnosticInfo(): Array<{
    sessionName: string;
    state: string;
    currentCommand?: CurrentCommand;
    executionDuration?: number;
  }> {
    const diagnostics: Array<{
      sessionName: string;
      state: string;
      currentCommand?: CurrentCommand;
      executionDuration?: number;
    }> = [];
    
    this.sessionStates.forEach((sessionState) => {
      const diagnostic = {
        sessionName: sessionState.sessionName,
        state: sessionState.state,
        currentCommand: sessionState.currentCommand,
        // Calculate execution duration for running commands
        executionDuration: sessionState.currentCommand 
          ? Date.now() - sessionState.currentCommand.startTime 
          : undefined
      };
      
      diagnostics.push(diagnostic);
    });
    
    return diagnostics;
  }
}