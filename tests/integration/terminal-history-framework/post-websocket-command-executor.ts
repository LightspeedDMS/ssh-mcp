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
 * Configuration for PostWebSocketCommandExecutor
 */
export interface PostWebSocketCommandExecutorConfig {
  commandTimeout?: number;          // Timeout for individual command execution
  interCommandDelay?: number;       // Delay between commands
  maxRetries?: number;             // Maximum retry attempts for failed commands
}

/**
 * Result of command execution with WebSocket correlation
 */
export interface CommandExecutionResult {
  command: string;
  success: boolean;
  mcpResponse?: MCPToolResponse;
  error?: string;
  capturedMessages: CapturedMessage[];
  executionStartTime: number;
  executionEndTime: number;
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
      maxRetries: config.maxRetries ?? 3
    };
  }

  /**
   * Execute commands sequentially after WebSocket connection
   */
  async executeCommands(
    commands: string[],
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
        const result = await this.executeCommand(command);
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
   */
  private async executeCommand(command: string): Promise<CommandExecutionResult> {
    if (!this.mcpClient) {
      throw new Error('MCPClient not provided');
    }

    const executionStartTime = Date.now();
    let mcpResponse: MCPToolResponse | undefined;
    let error: string | undefined;
    let success = false;

    // Get messages before command execution for correlation
    const messageCountBefore = this.getMessageCount();

    try {
      // Parse command to extract tool name and arguments
      const { toolName, args } = this.parseCommand(command);
      
      // Execute command via MCP
      mcpResponse = await this.mcpClient.callTool(toolName, args);
      success = mcpResponse.success;
      
      if (!success && mcpResponse.error) {
        error = mcpResponse.error;
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const executionEndTime = Date.now();

    // Wait for WebSocket messages to arrive (give some time for server response)
    await this.delay(500);

    // Get messages after command execution for correlation
    const capturedMessages = this.getMessagesAfter(messageCountBefore);

    return {
      command,
      success,
      mcpResponse,
      error,
      capturedMessages,
      executionStartTime,
      executionEndTime
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
   * Get current configuration
   */
  getConfig(): Required<PostWebSocketCommandExecutorConfig> {
    return { ...this.config };
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