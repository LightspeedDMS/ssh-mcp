/**
 * Story 5: Post-WebSocket Real-time Command Execution Implementation
 * 
 * PostWebSocketCommandExecutor executes commands sequentially after WebSocket connection
 * is established, integrating with MCPClient for command execution and 
 * InitialHistoryReplayCapture for WebSocket message correlation.
 * 
 * CRITICAL: No mocks in production code. This uses real MCP connections and WebSocket capture.
 */

import { MCPClient, MCPToolResponse } from './mcp-client';
import { InitialHistoryReplayCapture, CapturedMessage } from './initial-history-replay-capture';
import WebSocket from 'ws';

/**
 * Enhanced parameter structure for post-WebSocket commands
 * Story 01: Enhanced Parameter Structure Refactor
 */
export interface EnhancedCommandParameter {
  initiator: 'browser' | 'mcp-client';    // Command source specification
  command: string;                        // The actual command to execute
  cancel?: boolean;                       // Optional cancellation flag (default: false)
  waitToCancelMs?: number;               // Optional cancellation timeout (default: 10000ms)
}

/**
 * Type alias for backward compatibility
 */
export type PostWebSocketCommand = string | EnhancedCommandParameter;


/**
 * Configuration for PostWebSocketCommandExecutor
 */
export interface PostWebSocketCommandExecutorConfig {
  commandTimeout?: number;          // Timeout for individual command execution
  interCommandDelay?: number;       // Delay between commands
  maxRetries?: number;             // Maximum retry attempts for failed commands
  sessionName?: string;            // Session name for WebSocket commands (replaces hardcoded value)
  enableSequentialExecution?: boolean; // Story 03: Enable mixed protocol sequential execution
}

/**
 * Parameter validation error for enhanced command structure
 */
export class ParameterValidationError extends Error {
  constructor(message: string, public readonly parameter?: string) {
    super(message);
    this.name = 'ParameterValidationError';
  }
}

/**
 * Result of command execution with WebSocket correlation
 */
export interface CommandExecutionResult {
  command: string;
  initiator: 'browser' | 'mcp-client';    // Command initiator information
  success: boolean;
  mcpResponse?: MCPToolResponse;
  error?: string;
  capturedMessages: CapturedMessage[];
  executionStartTime: number;
  executionEndTime: number;
  cancelRequested?: boolean;              // Whether cancellation was requested
  waitToCancelMs?: number;               // Cancellation timeout that was used
}

/**
 * PostWebSocketCommandExecutor class - executes commands sequentially after WebSocket connection
 */
export class PostWebSocketCommandExecutor {
  private mcpClient?: MCPClient;
  private historyCapture?: InitialHistoryReplayCapture;
  private config: Required<PostWebSocketCommandExecutorConfig>;
  private executing: boolean = false;
  private currentWebSocket?: WebSocket;
  private browserCommandsExecuted: boolean = false; // Command State Synchronization tracking

  constructor(
    mcpClient?: MCPClient,
    historyCapture?: InitialHistoryReplayCapture,
    config: PostWebSocketCommandExecutorConfig = {}
  ) {
    this.mcpClient = mcpClient;
    this.historyCapture = historyCapture;
    this.config = {
      commandTimeout: config.commandTimeout ?? 30000,
      interCommandDelay: config.interCommandDelay ?? 1000,
      maxRetries: config.maxRetries ?? 3,
      sessionName: config.sessionName ?? 'default-test-session',
      enableSequentialExecution: config.enableSequentialExecution ?? true
    };
  }

  /**
   * Execute commands sequentially after WebSocket connection
   * Supports both string commands (legacy) and enhanced parameter objects
   */
  async executeCommands(
    commands: PostWebSocketCommand[],
    webSocket: WebSocket
  ): Promise<CommandExecutionResult[]> {
    if (this.executing) {
      throw new Error('Command execution already in progress');
    }

    this.executing = true;
    this.currentWebSocket = webSocket;

    try {
      const results: CommandExecutionResult[] = [];
      
      for (const command of commands) {
        // Convert string commands to enhanced parameter objects if needed
        const enhancedCommand = typeof command === 'string' 
          ? { initiator: 'mcp-client' as const, command } 
          : command;
        
        // Validate and normalize command parameter
        const normalizedCommand = this.validateAndNormalizeCommand(enhancedCommand);
        const result = await this.executeCommand(normalizedCommand);
        results.push(result);
        
        // Add inter-command delay if not the last command
        if (command !== commands[commands.length - 1]) {
          await this.delay(this.config.interCommandDelay);
        }
      }
      
      return results;
    } finally {
      this.executing = false;
      this.currentWebSocket = undefined;
    }
  }

  /**
   * Execute a single command with WebSocket message correlation
   * Implements dual-channel routing: browser commands via WebSocket, MCP commands via JSON-RPC
   * CRITICAL FIX 3: Allow validation errors to bubble up while capturing execution errors
   * Story 05: Enhanced with timeout-based cancellation support
   */
  private async executeCommand(commandParam: EnhancedCommandParameter): Promise<CommandExecutionResult> {
    if (!this.mcpClient) {
      throw new Error('MCPClient not provided');
    }

    const executionStartTime = Date.now();
    let mcpResponse: MCPToolResponse | undefined;
    let error: string | undefined;
    let success = false;
    let cancelled = false;

    // Get messages before command execution for correlation
    const messageCountBefore = this.getMessageCount();

    // Story 05: Setup cancellation timer if cancellation is requested
    let cancellationTimer: NodeJS.Timeout | undefined;
    let cancellationPromise: Promise<void> | undefined;
    
    if (commandParam.cancel) {
      const waitToCancelMs = commandParam.waitToCancelMs ?? 10000; // Default to 10 seconds
      
      // Validate timeout value (AC 5.14)
      if (waitToCancelMs <= 0) {
        throw new Error('waitToCancelMs must be positive value >= 1000');
      }
      
      if (waitToCancelMs < 1000) {
        throw new Error('waitToCancelMs must be positive value >= 1000');
      }
      
      cancellationPromise = new Promise<void>((resolve) => {
        cancellationTimer = setTimeout(async () => {
          console.debug(`Story 05: Cancellation timer expired for ${commandParam.initiator} command: ${commandParam.command}`);
          cancelled = true;
          
          try {
            if (commandParam.initiator === 'browser') {
              await this.cancelBrowserCommand(commandParam.command);
            } else {
              await this.cancelMCPCommand(commandParam.command);
            }
          } catch (cancelError) {
            console.error(`Story 05: Cancellation failed: ${cancelError instanceof Error ? cancelError.message : String(cancelError)}`);
            error = `Command cancellation failed: ${cancelError instanceof Error ? cancelError.message : String(cancelError)}`;
          }
          
          resolve();
        }, waitToCancelMs);
      });
    }

    try {
      // Story 05: Execute command with potential cancellation
      let commandExecutionPromise: Promise<boolean | MCPToolResponse>;
      
      if (commandParam.initiator === 'browser') {
        // Browser commands: Route via WebSocket terminal_input messages
        // Allow validation errors (WebSocket not open, etc.) to bubble up
        commandExecutionPromise = this.executeBrowserCommand(commandParam.command);
      } else {
        // Story 03: Sequential Execution - Check if Command State Synchronization applies
        if (this.browserCommandsExecuted && !this.config.enableSequentialExecution) {
          // Command State Synchronization: Block MCP commands after browser commands (original behavior)
          success = false;
          error = 'BROWSER_COMMANDS_EXECUTED';
          commandExecutionPromise = Promise.resolve(false);
        } else {
          // MCP client commands: Route via JSON-RPC stdin/stdout
          const { toolName, args } = this.parseCommand(commandParam.command);
          commandExecutionPromise = this.mcpClient.callTool(toolName, args);
        }
      }

      // Story 05: Race command execution against cancellation timer
      if (cancellationPromise) {
        // Set up a flag to track if cancellation occurred
        let cancellationOccurred = false;
        const cancellationTracker = cancellationPromise.then(() => {
          cancellationOccurred = true;
          return 'CANCELLED' as const;
        });
        
        const raceResult = await Promise.race([
          commandExecutionPromise.catch(err => ({ error: err })),
          cancellationTracker
        ]);
        
        if (raceResult === 'CANCELLED' || cancellationOccurred) {
          // Command was cancelled
          success = false;
          cancelled = true;
          error = error || 'Command cancelled due to timeout';
          
          console.debug(`Story 05: Command cancelled after timeout: ${commandParam.command}`);
        } else {
          // Command completed before cancellation
          // Clear the cancellation timer (AC 5.8)
          if (cancellationTimer) {
            clearTimeout(cancellationTimer);
            console.debug(`Story 05: Clearing cancellation timer - command completed naturally`);
          }
          
          // Handle normal completion or error
          if (typeof raceResult === 'object' && 'error' in raceResult) {
            // Command execution threw an error
            throw raceResult.error;
          }
          
          if (commandParam.initiator === 'browser') {
            success = raceResult as boolean;
            if (success) {
              this.browserCommandsExecuted = true;
            }
          } else {
            mcpResponse = raceResult as MCPToolResponse;
            success = mcpResponse.success;
            if (!success && mcpResponse.error) {
              error = mcpResponse.error;
            }
          }
        }
      } else {
        // No cancellation - execute normally
        const result = await commandExecutionPromise;
        
        if (commandParam.initiator === 'browser') {
          success = result as boolean;
          if (success) {
            this.browserCommandsExecuted = true;
          }
        } else {
          mcpResponse = result as MCPToolResponse;
          success = mcpResponse.success;
          if (!success && mcpResponse.error) {
            error = mcpResponse.error;
          }
        }
      }
    } catch (err) {
      // Clear cancellation timer on error
      if (cancellationTimer) {
        clearTimeout(cancellationTimer);
      }
      
      // CRITICAL FIX 3: Handle validation errors based on context
      success = false;
      error = err instanceof Error ? err.message : String(err);
      
      // For critical system validation errors (not WebSocket), re-throw
      if (err instanceof Error && (
          err.message.includes('MCPClient not provided') ||
          err.message.includes('Command execution already in progress')
        )) {
        throw err; // Let system validation errors bubble up
      }
      
      // WebSocket connection errors are captured in result for test validation
      console.debug(`Command execution failed: ${error}`);
    }

    const executionEndTime = Date.now();

    // Story 03: Enhanced WebSocket message capture for sequential execution
    if (this.config.enableSequentialExecution) {
      // Enhanced delay to ensure proper message capture in sequential execution
      await this.delay(1000);
      
      // Capture any remaining WebSocket messages for better correlation
      if (commandParam.initiator === 'browser' && this.currentWebSocket) {
        await this.captureRemainingWebSocketMessages();
      }
    } else {
      // Wait for WebSocket messages to arrive (give some time for server response)
      await this.delay(500);
    }

    // Get messages after command execution for correlation
    const capturedMessages = this.getMessagesAfter(messageCountBefore);

    return {
      command: commandParam.command,
      initiator: commandParam.initiator,
      success: cancelled ? false : success, // Story 05: Cancelled commands are not successful
      mcpResponse,
      error,
      capturedMessages,
      executionStartTime,
      executionEndTime,
      cancelRequested: commandParam.cancel ?? false,
      waitToCancelMs: commandParam.waitToCancelMs
    };
  }

  /**
   * Execute browser command via WebSocket terminal_input message
   * Implements AC 2.1: Command-level browser emulation
   */
  private async executeBrowserCommand(command: string): Promise<boolean> {
    if (!this.currentWebSocket) {
      throw new Error('WebSocket connection required for browser commands');
    }

    // Validate WebSocket connection with detailed state information - AC 2.7
    await this.ensureWebSocketOpen();
    if (this.currentWebSocket.readyState !== WebSocket.OPEN) {
      const readyStateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
      const currentStateName = readyStateNames[this.currentWebSocket.readyState] || 'UNKNOWN';
      throw new Error(
        `WebSocket connection not open for browser commands. ` +
        `Current state: ${currentStateName} (${this.currentWebSocket.readyState}). ` +
        `Expected: OPEN (1)`
      );
    }

    try {
      // Generate unique command ID for tracking and correlation - AC 2.8
      const commandId = this.generateCommandId();
      
      // Construct WebSocket terminal_input message per AC 2.2
      const terminalInputMessage = {
        type: 'terminal_input',
        sessionName: this.getSessionNameFromConnection(), // Dynamic session name
        command: command,
        commandId: commandId
      };

      // Send WebSocket message - AC 2.1: Command-level browser emulation
      const messageStr = JSON.stringify(terminalInputMessage);
      
      // Capture the WebSocket sent message for test verification - AC 2.5
      if (this.historyCapture) {
        this.historyCapture.captureWebSocketMessage('websocket_sent', terminalInputMessage);
      }
      
      this.currentWebSocket.send(messageStr);
      
      // Wait for command completion - AC 2.6: Command completion detection
      await this.waitForCommandCompletion(commandId);
      
      return true; // Success if no errors thrown
    } catch (error) {
      console.error('Browser command execution failed:', error);
      throw error; // Re-throw to ensure test failures are visible
    }
  }

  /**
   * Get session name from WebSocket connection context
   * Now properly configurable via constructor config
   */
  private getSessionNameFromConnection(): string {
    return this.config.sessionName;
  }

  /**
   * Wait for command completion via WebSocket response monitoring
   * Implements AC 2.6: Browser command completion detection
   */
  private async waitForCommandCompletion(commandId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(); // Complete after timeout - better than hanging indefinitely
      }, this.config.commandTimeout);

      let messageCount = 0;
      
      const messageHandler = (data: Buffer) => {
        try {
          const message = data.toString();
          let parsedMessage;
          
          try {
            parsedMessage = JSON.parse(message);
          } catch {
            parsedMessage = message; // Use raw message if not JSON
          }
          
          // Enhanced debugging for WebSocket messages
          console.debug(`WebSocket message ${messageCount + 1} for ${commandId}: ${message.slice(0, 100)}...`);
          
          // CRITICAL FIX 1: Capture WebSocket received messages
          if (this.historyCapture) {
            this.historyCapture.captureWebSocketMessage('websocket_received', parsedMessage);
          }
          
          messageCount++;
          
          // CRITICAL FIX 2: Proper command completion detection using prompt patterns
          const isCompletionSignal = this.detectCommandCompletionByPrompt(message, commandId);
          
          if (isCompletionSignal) {
            console.debug(`Command completed after ${messageCount} messages: ${commandId}`);
            cleanup();
            resolve();
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (this.currentWebSocket) {
          this.currentWebSocket.off('message', messageHandler);
        }
      };

      // Listen for WebSocket responses
      if (this.currentWebSocket) {
        this.currentWebSocket.on('message', messageHandler);
      } else {
        cleanup();
        reject(new Error('No WebSocket connection available for command completion detection'));
      }
    });
  }

  /**
   * CRITICAL FIX 2: Proper command completion detection by terminal prompt patterns
   * Uses sequence-based tracking since servers don't echo command IDs
   */
  private detectCommandCompletionByPrompt(message: string, commandId: string): boolean {
    let dataToCheck: string;
    
    // Extract data from JSON message or use raw message
    try {
      const parsed = JSON.parse(message);
      dataToCheck = parsed.data || parsed.output || message;
      
      // Server responses typically don't include our command IDs, so we rely on prompt detection
      // This is normal behavior for SSH terminals
    } catch {
      dataToCheck = message;
    }
    
    // Enhanced prompt pattern detection for reliable command completion
    const promptPatterns: RegExp[] = [
      /\[\w+@[^\]]+\s+[^\]]*\]\$\s*$/,    // Modern bracket format: [user@host dir]$
      /\w+@[^:]+:[^$]*\$\s*$/,              // Traditional format: user@host:dir$  
      /\$\s*$/,                            // Simple $ prompt
      />\s*$/,                             // Simple > prompt
      /terminal_ready/i,                   // Explicit ready signal
    ];
    
    // Check each pattern against the data
    const isComplete = promptPatterns.some(pattern => {
      return pattern.test(dataToCheck.trim());
    });
    
    if (isComplete) {
      console.debug(`Command completion detected for ${commandId}: prompt pattern matched in: "${dataToCheck.slice(-50)}"`);
    }
    
    return isComplete;
  }

  /**
   * Generate unique command ID for WebSocket message correlation
   * Implements AC 2.8: Command ID generation and tracking
   */
  private generateCommandId(): string {
    return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate enhanced command parameter object format
   */
  private validateAndNormalizeCommand(command: EnhancedCommandParameter): EnhancedCommandParameter {
    // Validate enhanced parameter object structure
    if (typeof command !== 'object' || command === null || Array.isArray(command)) {
      throw new ParameterValidationError('Command must be enhanced parameter object');
    }

    // Validate required fields
    if (!command.hasOwnProperty('initiator')) {
      throw new ParameterValidationError("initiator field required: must be 'browser' or 'mcp-client'");
    }

    if (!command.hasOwnProperty('command')) {
      throw new ParameterValidationError("command field required: must be non-empty string");
    }

    // Validate initiator
    if (command.initiator !== 'browser' && command.initiator !== 'mcp-client') {
      throw new ParameterValidationError("Initiator must be 'browser' or 'mcp-client'");
    }

    // Validate command string
    if (typeof command.command !== 'string' || command.command.trim().length === 0) {
      throw new ParameterValidationError("command field required: must be non-empty string");
    }

    // Validate cancel parameter
    if (command.cancel !== undefined && typeof command.cancel !== 'boolean') {
      throw new ParameterValidationError("cancel must be boolean value (true or false)");
    }

    // Validate waitToCancelMs parameter
    if (command.waitToCancelMs !== undefined) {
      if (typeof command.waitToCancelMs !== 'number') {
        throw new ParameterValidationError("waitToCancelMs must be numeric value in milliseconds");
      }
      if (command.waitToCancelMs <= 0) {
        throw new ParameterValidationError("waitToCancelMs must be positive number");
      }
    }

    // Log warning if waitToCancelMs provided but cancel is false
    if (command.cancel === false && command.waitToCancelMs !== undefined) {
      console.warn("waitToCancelMs ignored when cancel is false");
    }

    // Apply defaults
    return {
      initiator: command.initiator,
      command: command.command.trim(),
      cancel: command.cancel ?? false,
      waitToCancelMs: command.waitToCancelMs ?? 10000
    };
  }

  /**
   * Parse command string to extract tool name and arguments
   * Expected format: "toolName {JSON_ARGS}" or "toolName"
   */
  private parseCommand(command: string): { toolName: string; args: Record<string, unknown> } {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error('Empty command');
    }

    // Find the first space or opening brace to separate tool name from arguments
    const spaceIndex = trimmed.indexOf(' ');
    const braceIndex = trimmed.indexOf('{');
    
    let toolName: string;
    let argsString: string;
    
    if (spaceIndex === -1 && braceIndex === -1) {
      // No arguments - just tool name
      toolName = trimmed;
      return { toolName, args: {} };
    }
    
    // Find the split point - use the first occurrence of space or brace
    const splitIndex = (spaceIndex === -1) ? braceIndex : 
                      (braceIndex === -1) ? spaceIndex : 
                      Math.min(spaceIndex, braceIndex);
    
    toolName = trimmed.substring(0, splitIndex).trim();
    argsString = trimmed.substring(splitIndex).trim();
    
    if (!toolName) {
      throw new Error('Empty tool name');
    }
    
    // If arguments start with '{', parse as JSON
    if (argsString.startsWith('{')) {
      try {
        const args = JSON.parse(argsString);
        if (typeof args !== 'object' || args === null || Array.isArray(args)) {
          throw new Error('Arguments must be a JSON object');
        }
        return { toolName, args };
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`Invalid JSON in command arguments: ${error.message}`);
        }
        throw error;
      }
    }
    
    // Otherwise, treat as space-separated arguments (legacy format)
    const parts = argsString.split(/\s+/).filter(part => part.length > 0);
    const args: Record<string, unknown> = {};
    
    // For ssh_exec commands, join remaining parts as the command
    if (toolName === 'ssh_exec' && parts.length > 0) {
      args.command = parts.join(' ');
    } else {
      // For other tools, create numbered arguments
      for (let i = 0; i < parts.length; i++) {
        args[`arg${i + 1}`] = parts[i];
      }
    }

    return { toolName, args };
  }

  /**
   * Get current message count from history capture
   */
  private getMessageCount(): number {
    if (!this.historyCapture || !this.currentWebSocket) {
      return 0;
    }

    return this.historyCapture.getRealTimeMessages().length + 
           this.historyCapture.getHistoryMessages().length;
  }

  /**
   * Get messages captured after a specific message count
   */
  private getMessagesAfter(previousCount: number): CapturedMessage[] {
    if (!this.historyCapture) {
      return [];
    }

    const allMessages = [
      ...this.historyCapture.getHistoryMessages(),
      ...this.historyCapture.getRealTimeMessages()
    ];

    return allMessages.slice(previousCount);
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if currently executing commands
   */
  isExecuting(): boolean {
    return this.executing;
  }

  /**
   * Ensure WebSocket connection is in OPEN state
   * Waits for connection to be established if currently connecting
   */
  private async ensureWebSocketOpen(): Promise<void> {
    if (!this.currentWebSocket) {
      return;
    }

    // If currently connecting, wait for connection to be established
    if (this.currentWebSocket.readyState === WebSocket.CONNECTING) {
      console.debug('WebSocket is CONNECTING, waiting for OPEN state...');
      
      // Wait up to 5 seconds for connection to be established
      const timeout = 5000;
      const startTime = Date.now();
      
      while (this.currentWebSocket.readyState === WebSocket.CONNECTING && 
             Date.now() - startTime < timeout) {
        await this.delay(100);
      }
      
      console.debug(`WebSocket state after waiting: ${this.currentWebSocket.readyState}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<PostWebSocketCommandExecutorConfig> {
    return { ...this.config };
  }

  /**
   * Story 03: Capture remaining WebSocket messages for better sequential execution correlation
   */
  private async captureRemainingWebSocketMessages(): Promise<void> {
    if (!this.currentWebSocket || !this.historyCapture) {
      return;
    }

    // Listen for additional WebSocket messages for a short period
    return new Promise<void>((resolve) => {
      const captureTimeout = setTimeout(() => {
        cleanup();
        resolve();
      }, 500);

      let messageCount = 0;
      const maxMessages = 5; // Limit to prevent infinite capture

      const messageHandler = (data: Buffer) => {
        try {
          const message = data.toString();
          let parsedMessage;
          
          try {
            parsedMessage = JSON.parse(message);
          } catch {
            parsedMessage = message; // Use raw message if not JSON
          }
          
          // Capture the message for correlation
          if (this.historyCapture) {
            this.historyCapture.captureWebSocketMessage('websocket_received', parsedMessage);
          }
          
          messageCount++;
          
          // Limit message capture to prevent indefinite waiting
          if (messageCount >= maxMessages) {
            cleanup();
            resolve();
          }
        } catch (error) {
          console.error('Error capturing remaining WebSocket message:', error);
        }
      };

      const cleanup = () => {
        if (captureTimeout) clearTimeout(captureTimeout);
        if (this.currentWebSocket) {
          this.currentWebSocket.off('message', messageHandler);
        }
      };

      // Listen for WebSocket messages
      if (this.currentWebSocket) {
        this.currentWebSocket.on('message', messageHandler);
      } else {
        cleanup();
        resolve();
      }
    });
  }

  /**
   * Story 05: Cancel browser command via WebSocket SIGINT signal
   * Implements AC 5.4: WebSocket SIGINT signal cancellation
   */
  private async cancelBrowserCommand(command: string): Promise<void> {
    if (!this.currentWebSocket || this.currentWebSocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not available for browser command cancellation');
    }

    // AC 5.4: Send WebSocket message: {type: 'terminal_signal', sessionName: 'test-session', signal: 'SIGINT'}
    const sigintMessage = {
      type: 'terminal_signal',
      sessionName: this.config.sessionName,
      signal: 'SIGINT'
    };

    console.debug(`Story 05: Sending WebSocket SIGINT signal for browser command: ${command}`);
    
    // Capture the WebSocket sent message for test verification
    if (this.historyCapture) {
      this.historyCapture.captureWebSocketMessage('websocket_sent', sigintMessage);
    }
    
    this.currentWebSocket.send(JSON.stringify(sigintMessage));
    
    // Wait longer for the signal to be processed and ^C response to be captured
    await this.delay(1000);
  }

  /**
   * Story 05: Cancel MCP command via ssh_cancel_command tool
   * Implements AC 5.5: MCP ssh_cancel_command cancellation
   */
  private async cancelMCPCommand(command: string): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCPClient not available for MCP command cancellation');
    }

    console.debug(`Story 05: Sending MCP ssh_cancel_command for command: ${command}`);
    
    try {
      // AC 5.5: Call ssh_cancel_command tool with session name
      const cancelResponse = await this.mcpClient.callTool('ssh_cancel_command', {
        sessionName: this.config.sessionName
      });
      
      console.debug(`Story 05: MCP cancellation response:`, cancelResponse);
      
      // Handle the case where there's no active command to cancel
      if (!cancelResponse.success && cancelResponse.error === 'NO_ACTIVE_MCP_COMMAND') {
        console.debug('Story 05: No active MCP command to cancel - command may have completed');
        // This is not necessarily an error - the command may have completed naturally
        return;
      }
      
      if (!cancelResponse.success) {
        throw new Error(`MCP cancellation failed: ${cancelResponse.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Story 05: MCP command cancellation failed:`, error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.executing = false;
    this.currentWebSocket = undefined;
    // Note: We don't cleanup mcpClient or historyCapture as they're managed externally
  }
}